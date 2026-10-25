package it.inordine.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(NativeSpeechRecognition.class);
        registerPlugin(BackupFilePicker.class);
        super.onCreate(savedInstanceState);
    }
}
