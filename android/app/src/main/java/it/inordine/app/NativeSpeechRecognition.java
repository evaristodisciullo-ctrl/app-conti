package it.inordine.app;

import android.Manifest;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import android.os.Bundle;
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

@CapacitorPlugin(
    name = "NativeSpeechRecognition",
    permissions = {@Permission(alias = "audio", strings = {Manifest.permission.RECORD_AUDIO})}
)
public class NativeSpeechRecognition extends Plugin {
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private SpeechRecognizer recognizer;
    private PluginCall listeningCall;

    @PluginMethod
    public void listen(PluginCall call) {
        if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
            call.reject("Speech recognition service is unavailable", "SERVICE_UNAVAILABLE");
            return;
        }
        if (!hasRequiredPermissions()) {
            saveCall(call);
            requestPermissionForAlias("audio", call, "permissionCallback");
            return;
        }
        startListening(call);
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        if (hasRequiredPermissions()) startListening(call);
        else call.reject("Microphone permission denied", "PERMISSION_DENIED");
    }

    private void startListening(PluginCall call) {
        // SpeechRecognizer is a main-looper-only Android API. Plugin calls may be
        // dispatched from Capacitor's bridge executor, so always marshal it here.
        if (Looper.myLooper() != Looper.getMainLooper()) {
            mainHandler.post(() -> startListening(call));
            return;
        }
        stopRecognizer(false);
        listeningCall = call;
        try {
        recognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
        recognizer.setRecognitionListener(new RecognitionListener() {
            @Override public void onReadyForSpeech(Bundle params) {}
            @Override public void onBeginningOfSpeech() {}
            @Override public void onRmsChanged(float rmsdB) {}
            @Override public void onBufferReceived(byte[] buffer) {}
            @Override public void onEndOfSpeech() {}
            @Override public void onPartialResults(Bundle partialResults) {}
            @Override public void onEvent(int eventType, Bundle params) {}
            @Override public void onError(int error) {
                PluginCall active = listeningCall;
                listeningCall = null;
                stopRecognizer(false);
                if (active != null) active.reject(errorMessage(error), errorCode(error));
            }
            @Override public void onResults(Bundle results) {
                PluginCall active = listeningCall;
                listeningCall = null;
                java.util.ArrayList<String> candidates = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                stopRecognizer(false);
                if (active == null) return;
                if (candidates == null || candidates.isEmpty()) {
                    active.reject("No speech was recognized", "NO_SPEECH");
                    return;
                }
                JSObject result = new JSObject();
                result.put("transcript", candidates.get(0));
                active.resolve(result);
            }
        });
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, call.getString("language", "it-IT"));
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3);
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false);
        recognizer.startListening(intent);
        } catch (RuntimeException error) {
            PluginCall active = listeningCall;
            listeningCall = null;
            stopRecognizer(true);
            if (active != null) active.reject("Unable to start speech recognition", "START_FAILED", error);
        }
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        mainHandler.post(() -> {
            PluginCall active = listeningCall;
            listeningCall = null;
            stopRecognizer(true);
            if (active != null) active.reject("Speech recognition cancelled", "CANCELLED");
            call.resolve();
        });
    }

    private void stopRecognizer(boolean cancel) {
        if (Looper.myLooper() != Looper.getMainLooper()) {
            mainHandler.post(() -> stopRecognizer(cancel));
            return;
        }
        if (recognizer == null) return;
        try {
            if (cancel) recognizer.cancel();
        } catch (RuntimeException ignored) { }
        try { recognizer.destroy(); } catch (RuntimeException ignored) { }
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

    private static String errorMessage(int error) {
        return "Speech recognition failed (Android error " + error + "): " + errorCode(error);
    }

    @Override
    protected void handleOnDestroy() {
        mainHandler.post(() -> {
            listeningCall = null;
            stopRecognizer(true);
        });
        super.handleOnDestroy();
    }
}
