package it.inordine.app;

import android.Manifest;
import android.content.Intent;
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
                if (active != null) active.reject("Speech recognition failed: " + error, "RECOGNITION_ERROR");
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
        PluginCall active = listeningCall;
        listeningCall = null;
        stopRecognizer(true);
        if (active != null) active.reject("Speech recognition cancelled", "CANCELLED");
        call.resolve();
    }

    private void stopRecognizer(boolean cancel) {
        if (recognizer == null) return;
        if (cancel) recognizer.cancel();
        recognizer.destroy();
        recognizer = null;
    }

    @Override
    protected void handleOnDestroy() {
        listeningCall = null;
        stopRecognizer(true);
        super.handleOnDestroy();
    }
}
