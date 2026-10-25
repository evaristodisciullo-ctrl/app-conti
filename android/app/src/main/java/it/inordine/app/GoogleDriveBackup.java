package it.inordine.app;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.ClearTokenRequest;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.common.api.Scope;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Collections;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Google Drive provider restricted to the app-private appDataFolder. */
@CapacitorPlugin(name = "GoogleDriveBackup")
public class GoogleDriveBackup extends Plugin {
    private static final String SCOPE = "https://www.googleapis.com/auth/drive.appdata";
    private static final String API = "https://www.googleapis.com/drive/v3/files";
    private static final String UPLOAD_API = "https://www.googleapis.com/upload/drive/v3/files";
    private static final int MAX_BACKUP_BYTES = 10 * 1024 * 1024;
    private final ExecutorService io = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("configured", BuildConfig.INORDINE_DRIVE_BACKUP_ENABLED);
        result.put("scope", "drive.appdata");
        call.resolve(result);
    }

    @PluginMethod
    public void saveBackup(PluginCall call) {
        if (!requireConfigured(call)) return;
        String contents = call.getString("contents");
        String fileName = call.getString("fileName", "InOrdine_Backup.json");
        if (contents == null || contents.isEmpty() || contents.getBytes(StandardCharsets.UTF_8).length > MAX_BACKUP_BYTES) {
            call.reject("Backup size or content is invalid", "FILE_INVALID"); return;
        }
        authorize(call);
    }

    @PluginMethod
    public void listBackups(PluginCall call) {
        if (!requireConfigured(call)) return;
        authorize(call);
    }

    @PluginMethod
    public void readBackup(PluginCall call) {
        if (!requireConfigured(call)) return;
        if (empty(call.getString("id"))) { call.reject("Backup identifier is missing", "CLOUD_FILE_INVALID"); return; }
        authorize(call);
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        if (!requireConfigured(call)) return;
        Identity.getAuthorizationClient(getActivity()).revokeAccess(com.google.android.gms.auth.api.identity.RevokeAccessRequest.builder().setScopes(Collections.singletonList(new Scope(SCOPE))).build())
            .addOnSuccessListener(unused -> call.resolve())
            .addOnFailureListener(error -> call.reject("Google Drive permission could not be revoked", "AUTHORIZATION_FAILED", error));
    }

    private boolean requireConfigured(PluginCall call) {
        if (!BuildConfig.INORDINE_DRIVE_BACKUP_ENABLED) {
            call.reject("Google Drive automatic backups are not configured for this build", "DRIVE_NOT_CONFIGURED");
            return false;
        }
        return true;
    }

    private void authorize(PluginCall call) {
        AuthorizationRequest request = AuthorizationRequest.builder()
            .setRequestedScopes(Collections.singletonList(new Scope(SCOPE))).build();
        Identity.getAuthorizationClient(getActivity()).authorize(request)
            .addOnSuccessListener(result -> {
                if (result.hasResolution()) {
                    Intent intent = new Intent(getContext(), GoogleDriveAuthorizationActivity.class);
                    intent.putExtra(GoogleDriveAuthorizationActivity.EXTRA_PENDING_INTENT, result.getPendingIntent());
                    startActivityForResult(call, intent, "authorizationResult");
                } else if (!result.getGrantedScopes().contains(SCOPE) || empty(result.getAccessToken())) {
                    call.reject("Google Drive backup permission was not granted", "AUTHORIZATION_DENIED");
                } else {
                    runOperation(call, result.getAccessToken());
                }
            })
            .addOnFailureListener(error -> call.reject("Could not connect to the selected Google account", "AUTHORIZATION_FAILED", error));
    }

    @ActivityCallback
    private void authorizationResult(PluginCall call, ActivityResult activityResult) {
        if (activityResult.getResultCode() != android.app.Activity.RESULT_OK || activityResult.getData() == null) {
            call.reject("Google Drive authorization was cancelled", "AUTHORIZATION_CANCELLED"); return;
        }
        try {
            AuthorizationResult result = Identity.getAuthorizationClient(getActivity()).getAuthorizationResultFromIntent(activityResult.getData());
            if (!result.getGrantedScopes().contains(SCOPE) || empty(result.getAccessToken())) {
                call.reject("Google Drive backup permission was not granted", "AUTHORIZATION_DENIED"); return;
            }
            runOperation(call, result.getAccessToken());
        } catch (Exception error) {
            call.reject("Google Drive authorization expired or was revoked. Try again to reconnect.", "AUTHORIZATION_EXPIRED", error);
        }
    }

    private void runOperation(PluginCall call, String token) {
        String method = call.getMethodName();
        io.execute(() -> {
            try {
                if (!hasValidatedInternet()) throw new CloudException("NETWORK_UNAVAILABLE", "No validated Internet connection is available");
                JSObject result;
                if ("saveBackup".equals(method)) result = uploadAndVerify(token, call.getString("contents"), call.getString("fileName", "InOrdine_Backup.json"));
                else if ("listBackups".equals(method)) result = list(token);
                else if ("readBackup".equals(method)) result = read(token, call.getString("id"));
                else throw new CloudException("CLOUD_OPERATION_UNSUPPORTED", "Unsupported Drive operation");
                call.resolve(result);
            } catch (CloudException error) {
                if ("AUTHORIZATION_EXPIRED".equals(error.code)) {
                    Identity.getAuthorizationClient(getActivity()).clearToken(ClearTokenRequest.builder().setToken(token).build())
                        .addOnCompleteListener(unused -> call.reject(error.getMessage(), error.code, error));
                } else call.reject(error.getMessage(), error.code, error);
            } catch (Exception error) {
                call.reject("Google Drive request failed. Check the connection and retry.", "CLOUD_REQUEST_FAILED", error);
            }
        });
    }

    private JSObject uploadAndVerify(String token, String contents, String name) throws Exception {
        byte[] expected = contents.getBytes(StandardCharsets.UTF_8);
        String boundary = "inordine_" + Long.toHexString(System.nanoTime());
        URL url = new URL(UPLOAD_API + "?uploadType=multipart&fields=id,name,modifiedTime,size");
        HttpURLConnection connection = open(url, token, "POST");
        connection.setDoOutput(true);
        connection.setRequestProperty("Content-Type", "multipart/related; boundary=" + boundary);
        try (OutputStream out = connection.getOutputStream()) {
            out.write(("--" + boundary + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n").getBytes(StandardCharsets.UTF_8));
            JSONObject metadata = new JSONObject(); metadata.put("name", name); metadata.put("mimeType", "application/json");
            metadata.put("parents", new JSONArray().put("appDataFolder"));
            out.write(metadata.toString().getBytes(StandardCharsets.UTF_8));
            out.write(("\r\n--" + boundary + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n").getBytes(StandardCharsets.UTF_8));
            out.write(expected); out.write(("\r\n--" + boundary + "--").getBytes(StandardCharsets.UTF_8));
        }
        JSONObject uploaded = responseJson(connection);
        String id = uploaded.optString("id", "");
        if (empty(id)) throw new CloudException("CLOUD_UPLOAD_UNVERIFIED", "Drive did not confirm the uploaded backup");
        byte[] actual = downloadBytes(token, id);
        if (!Arrays.equals(expected, actual)) throw new CloudException("CLOUD_UPLOAD_UNVERIFIED", "Uploaded backup could not be verified by reading it back");
        JSObject result = new JSObject(); result.put("id", id); result.put("fileName", uploaded.optString("name", name));
        result.put("modifiedTime", uploaded.optString("modifiedTime", "")); result.put("bytes", actual.length); result.put("verified", true);
        return result;
    }

    private JSObject list(String token) throws Exception {
        JSONArray files = new JSONArray(); String pageToken = null; int pages = 0;
        do {
            String query = "spaces=appDataFolder&pageSize=100&orderBy=modifiedTime%20desc&fields=nextPageToken,files(id,name,mimeType,modifiedTime,size)&q=" + enc("trashed=false");
            if (!empty(pageToken)) query += "&pageToken=" + enc(pageToken);
            JSONObject page = getJson(token, API + "?" + query);
            JSONArray items = page.optJSONArray("files");
            if (items != null) for (int i = 0; i < items.length(); i++) {
                JSONObject item = items.optJSONObject(i); if (item == null) continue;
                String name = item.optString("name", "");
                if (!name.startsWith("InOrdine_Backup_") || !name.endsWith(".json")) continue;
                JSObject file = new JSObject(); file.put("id", item.optString("id")); file.put("fileName", name);
                file.put("modifiedTime", item.optString("modifiedTime", "")); file.put("size", item.optString("size", "0")); files.put(file);
            }
            pageToken = page.optString("nextPageToken", null); pages++;
        } while (!empty(pageToken) && pages < 10);
        if (!empty(pageToken)) throw new CloudException("CLOUD_LIST_FAILED", "Too many Drive backups to list safely");
        JSObject result = new JSObject(); result.put("files", files); return result;
    }

    private JSObject read(String token, String id) throws Exception {
        byte[] contents = downloadBytes(token, id);
        JSObject result = new JSObject(); result.put("contents", new String(contents, StandardCharsets.UTF_8));
        JSONObject metadata = getJson(token, API + "/" + enc(id) + "?fields=id,name,modifiedTime");
        result.put("fileName", metadata.optString("name", "")); result.put("modifiedTime", metadata.optString("modifiedTime", ""));
        return result;
    }

    private byte[] downloadBytes(String token, String id) throws Exception {
        HttpURLConnection connection = open(new URL(API + "/" + enc(id) + "?alt=media"), token, "GET");
        return responseBytes(connection);
    }

    private JSONObject getJson(String token, String endpoint) throws Exception {
        return responseJson(open(new URL(endpoint), token, "GET"));
    }

    private HttpURLConnection open(URL url, String token, String method) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setRequestMethod(method); connection.setConnectTimeout(20000); connection.setReadTimeout(30000);
        connection.setRequestProperty("Authorization", "Bearer " + token); connection.setRequestProperty("Accept", "application/json");
        return connection;
    }

    private JSONObject responseJson(HttpURLConnection connection) throws Exception {
        byte[] bytes = responseBytes(connection);
        try { return new JSONObject(new String(bytes, StandardCharsets.UTF_8)); }
        catch (Exception error) { throw new CloudException("CLOUD_RESPONSE_INVALID", "Google Drive returned an invalid response"); }
    }

    private byte[] responseBytes(HttpURLConnection connection) throws Exception {
        int status = connection.getResponseCode();
        InputStream stream = status >= 200 && status < 300 ? connection.getInputStream() : connection.getErrorStream();
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        if (stream != null) try (InputStream input = stream) {
            byte[] buffer = new byte[8192]; int count;
            while ((count = input.read(buffer)) != -1) {
                if (output.size() + count > MAX_BACKUP_BYTES + 65536) throw new CloudException("CLOUD_FILE_TOO_LARGE", "Drive backup exceeds the supported size");
                output.write(buffer, 0, count);
            }
        }
        if (status == 401) throw new CloudException("AUTHORIZATION_EXPIRED", "Google Drive access expired or was revoked. Reconnect the account and retry.");
        if (status == 403) throw new CloudException("CLOUD_PERMISSION_DENIED", "Google Drive denied this request. Check that Drive API and app permissions are configured.");
        if (status < 200 || status >= 300) throw new CloudException("CLOUD_REQUEST_FAILED", "Google Drive returned HTTP " + status);
        return output.toByteArray();
    }

    private boolean hasValidatedInternet() {
        ConnectivityManager manager = (ConnectivityManager) getContext().getSystemService(Context.CONNECTIVITY_SERVICE);
        Network active = manager == null ? null : manager.getActiveNetwork();
        NetworkCapabilities caps = active == null || manager == null ? null : manager.getNetworkCapabilities(active);
        return caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
    }

    private static String enc(String value) throws Exception { return URLEncoder.encode(value, "UTF-8"); }
    private static boolean empty(String value) { return value == null || value.trim().isEmpty(); }

    private static final class CloudException extends Exception {
        final String code;
        CloudException(String code, String message) { super(message); this.code = code; }
    }
}
