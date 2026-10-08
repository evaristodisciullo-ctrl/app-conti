package it.inordine.app;

import android.Manifest;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;

@CapacitorPlugin(name = "NativeSpeechRecognition", permissions = {@Permission(alias = "audio", strings = {Manifest.permission.RECORD_AUDIO})})
public class NativeSpeechRecognition extends Plugin {
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private SpeechRecognizer recognizer;
    private PluginCall listeningCall;
    private String language = "it-IT";
    private String latestTranscript = "";

    @PluginMethod
    public void listen(PluginCall call) {
        if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
            call.reject("Speech recognition service is unavailable", "SERVICE_UNAVAILABLE");
            return;
        }
        language = call.getString("language", "it-IT");
        latestTranscript = "";
        if (!hasRequiredPermissions()) {
            listeningCall = call;
            requestPermissionForAlias("audio", call, "permissionCallback");
            return;
        }
        mainHandler.post(() -> beginSession(call));
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        if (hasRequiredPermissions()) mainHandler.post(() -> beginSession(call));
        else {
            listeningCall = null;
            call.reject("Microphone permission denied", "PERMISSION_DENIED");
        }
    }

    private void beginSession(PluginCall call) {
        if (Looper.myLooper() != Looper.getMainLooper()) { mainHandler.post(() -> beginSession(call)); return; }
        destroyRecognizer(true);
        listeningCall = call;
        startListening();
    }

    private void startListening() {
        if (Looper.myLooper() != Looper.getMainLooper()) { mainHandler.post(this::startListening); return; }
        if (listeningCall == null) return;
        if (!SpeechRecognizer.isRecognitionAvailable(getContext())) { emitState("error", "SERVICE_UNAVAILABLE", "Servizio vocale non disponibile"); return; }
        destroyRecognizer(true);
        try {
            recognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
            recognizer.setRecognitionListener(new RecognitionListener() {
                @Override public void onReadyForSpeech(Bundle params) { emitState("ready", "", ""); }
                @Override public void onBeginningOfSpeech() { emitState("recording", "", ""); }
                @Override public void onRmsChanged(float rmsdB) { JSObject data = new JSObject(); data.put("rms", rmsdB); notifyListeners("speechLevel", data); }
                @Override public void onBufferReceived(byte[] buffer) {}
                @Override public void onEndOfSpeech() { emitState("recognizing", "", ""); }
                @Override public void onPartialResults(Bundle partialResults) { updateTranscript(partialResults, false); }
                @Override public void onEvent(int eventType, Bundle params) {}
                @Override public void onError(int error) {
                    destroyRecognizer(false);
                    emitState("error", errorCode(error), errorMessage(error));
                }
                @Override public void onResults(Bundle results) { updateTranscript(results, true); }
            });
            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, language);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, language);
            intent.putExtra(RecognizerIntent.EXTRA_ONLY_RETURN_LANGUAGE_PREFERENCE, false);
            intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3);
            intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
            recognizer.startListening(intent);
            emitState("starting", "", "");
        } catch (RuntimeException error) {
            destroyRecognizer(true);
            emitState("error", "START_FAILED", "Impossibile avviare il riconoscimento vocale");
        }
    }

    private void updateTranscript(Bundle results, boolean isFinal) {
        ArrayList<String> candidates = results == null ? null : results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (candidates != null && !candidates.isEmpty()) latestTranscript = candidates.get(0);
        JSObject data = new JSObject(); data.put("transcript", latestTranscript); data.put("isFinal", isFinal);
        notifyListeners("speechTranscript", data);
        if (isFinal) emitState("review", "", "");
    }

    @PluginMethod
    public void retry(PluginCall call) {
        mainHandler.post(() -> { latestTranscript = ""; emitState("starting", "", ""); startListening(); call.resolve(); });
    }

    @PluginMethod
    public void confirm(PluginCall call) {
        mainHandler.post(() -> {
            String text = call.getString("transcript", latestTranscript);
            PluginCall active = listeningCall; listeningCall = null; destroyRecognizer(true);
            if (active != null) { JSObject result = new JSObject(); result.put("transcript", text == null ? "" : text); active.resolve(result); }
            call.resolve();
        });
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        mainHandler.post(() -> {
            PluginCall active = listeningCall; listeningCall = null; destroyRecognizer(true);
            if (active != null) active.reject("Speech recognition cancelled", "CANCELLED");
            call.resolve();
        });
    }

    private void emitState(String state, String code, String message) {
        JSObject data = new JSObject(); data.put("state", state); data.put("code", code); data.put("message", message);
        notifyListeners("speechState", data);
    }

    private void destroyRecognizer(boolean cancel) {
        if (Looper.myLooper() != Looper.getMainLooper()) { mainHandler.post(() -> destroyRecognizer(cancel)); return; }
        if (recognizer == null) return;
        try { if (cancel) recognizer.cancel(); } catch (RuntimeException ignored) {}
        try { recognizer.destroy(); } catch (RuntimeException ignored) {}
        recognizer = null;
    }

    private static String errorCode(int error) {
        switch (error) {
            case SpeechRecognizer.ERROR_NETWORK: return "NETWORK";
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT: return "NETWORK_TIMEOUT";
            case SpeechRecognizer.ERROR_AUDIO: return "AUDIO_ERROR";
            case SpeechRecognizer.ERROR_CLIENT: return "CLIENT_ERROR";
            case SpeechRecognizer.ERROR_RECOGNIZER_BUSY: return "BUSY";
            case SpeechRecognizer.ERROR_SERVER: return "SERVER_ERROR";
            case SpeechRecognizer.ERROR_NO_MATCH: return "NO_MATCH";
            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT: return "NO_SPEECH";
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS: return "PERMISSION_DENIED";
            default: return "RECOGNITION_ERROR";
        }
    }
    private static String errorMessage(int error) { return "Speech recognition failed (Android error " + error + "): " + errorCode(error); }

    @Override protected void handleOnPause() {
        mainHandler.post(() -> { destroyRecognizer(true); if (listeningCall != null) emitState("error", "INTERRUPTED", "L’ascolto è stato interrotto"); });
        super.handleOnPause();
    }
    @Override protected void handleOnDestroy() {
        mainHandler.post(() -> { listeningCall = null; destroyRecognizer(true); });
        super.handleOnDestroy();
    }
}
