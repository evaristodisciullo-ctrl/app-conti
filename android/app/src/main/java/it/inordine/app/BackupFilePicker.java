package it.inordine.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import androidx.activity.result.ActivityResult;

import java.io.ByteArrayOutputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "BackupFilePicker")
public class BackupFilePicker extends Plugin {
    private static final int MAX_BACKUP_BYTES = 10 * 1024 * 1024;

    @PluginMethod
    public void saveFile(PluginCall call) {
        String contents = call.getString("contents");
        String fileName = call.getString("fileName", "InOrdine_Backup.json");
        if (contents == null) {
            call.reject("Backup content is missing", "FILE_NOT_SAVED");
            return;
        }
        byte[] bytes = contents.getBytes(StandardCharsets.UTF_8);
        if (bytes.length == 0 || bytes.length > MAX_BACKUP_BYTES) {
            call.reject("Backup size is invalid", "FILE_NOT_SAVED");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json");
        intent.putExtra(Intent.EXTRA_TITLE, fileName);
        startActivityForResult(call, intent, "saveResult");
    }

    @ActivityCallback
    private void saveResult(PluginCall call, ActivityResult result) {
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            JSObject response = new JSObject();
            response.put("cancelled", true);
            response.put("saved", false);
            call.resolve(response);
            return;
        }
        Uri uri = result.getData().getData();
        String contents = call.getString("contents", "");
        byte[] expected = contents.getBytes(StandardCharsets.UTF_8);
        try {
            OutputStream output = getContext().getContentResolver().openOutputStream(uri, "wt");
            if (output == null) throw new IllegalStateException("Could not open selected destination");
            try (OutputStream stream = output) {
                stream.write(expected);
                stream.flush();
                if (stream instanceof FileOutputStream) ((FileOutputStream) stream).getFD().sync();
            }
            byte[] actual;
            try (InputStream input = getContext().getContentResolver().openInputStream(uri);
                 ByteArrayOutputStream verification = new ByteArrayOutputStream()) {
                if (input == null) throw new IllegalStateException("Could not verify saved file");
                byte[] buffer = new byte[8192];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    if (verification.size() + count > MAX_BACKUP_BYTES) throw new IllegalStateException("Saved backup is too large");
                    verification.write(buffer, 0, count);
                }
                actual = verification.toByteArray();
            }
            if (!java.util.Arrays.equals(actual, expected)) throw new IllegalStateException("Saved file verification failed");
            JSObject response = new JSObject();
            response.put("saved", true);
            response.put("fileName", fileNameFromUri(uri));
            response.put("bytes", actual.length);
            call.resolve(response);
        } catch (Exception error) {
            call.reject("The selected destination could not save or verify the backup", "FILE_NOT_SAVED", error);
        }
    }

    @PluginMethod
    public void openFile(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/json", "text/json", "text/plain", "application/octet-stream"});
        startActivityForResult(call, intent, "openResult");
    }

    @ActivityCallback
    private void openResult(PluginCall call, ActivityResult result) {
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            JSObject response = new JSObject();
            response.put("cancelled", true);
            call.resolve(response);
            return;
        }
        Uri uri = result.getData().getData();
        try (InputStream input = getContext().getContentResolver().openInputStream(uri);
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            if (input == null) throw new IllegalStateException("Selected file cannot be opened");
            byte[] buffer = new byte[8192];
            int count;
            while ((count = input.read(buffer)) != -1) {
                if (output.size() + count > MAX_BACKUP_BYTES) throw new IllegalArgumentException("Backup is too large");
                output.write(buffer, 0, count);
            }
            JSObject response = new JSObject();
            response.put("cancelled", false);
            response.put("fileName", fileNameFromUri(uri));
            response.put("contents", new String(output.toByteArray(), StandardCharsets.UTF_8));
            call.resolve(response);
        } catch (Exception error) {
            call.reject("Selected backup could not be read", "FILE_INVALID", error);
        }
    }

    private String fileNameFromUri(Uri uri) {
        String path = uri.getLastPathSegment();
        if (path == null) return "InOrdine_Backup.json";
        int slash = path.lastIndexOf('/');
        return slash >= 0 ? path.substring(slash + 1) : path;
    }
}
