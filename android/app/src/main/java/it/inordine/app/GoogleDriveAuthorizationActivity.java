package it.inordine.app;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.Intent;
import android.os.Bundle;

/** Starts Google's consent PendingIntent and relays its result to Capacitor. */
public final class GoogleDriveAuthorizationActivity extends Activity {
    static final String EXTRA_PENDING_INTENT = "googleDriveAuthorizationPendingIntent";
    private static final int AUTHORIZATION_REQUEST = 4172;

    @Override
    @SuppressWarnings("deprecation")
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        PendingIntent pending = getIntent().getParcelableExtra(EXTRA_PENDING_INTENT);
        if (pending == null) { setResult(RESULT_CANCELED); finish(); return; }
        try { startIntentSenderForResult(pending.getIntentSender(), AUTHORIZATION_REQUEST, null, 0, 0, 0); }
        catch (Exception error) { setResult(RESULT_CANCELED); finish(); }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != AUTHORIZATION_REQUEST) return;
        setResult(resultCode, data);
        finish();
    }
}
