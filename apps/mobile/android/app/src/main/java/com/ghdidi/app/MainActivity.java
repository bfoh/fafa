package com.ghdidi.app;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import java.util.regex.Pattern;

public class MainActivity extends BridgeActivity {

    // Only path-safe ids reach the URL — notification extras arrive via
    // OS-level payloads, so never trust them to build a load target unvalidated.
    private static final Pattern SAFE_SEGMENT = Pattern.compile("^[A-Za-z0-9_-]+$");

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Cold-start notification tap: FCM delivers the push data payload
        // ({ orderId, slug }, see apps/web/lib/notifications/push.ts) as launch
        // intent extras. Point the web view straight at the order tracker so the
        // customer never sees the landing page while the JS tap handler boots.
        String url = orderTrackerUrl(getIntent());
        if (url != null && bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().loadUrl(url);
        }
    }

    private String orderTrackerUrl(Intent intent) {
        if (intent == null) return null;
        String orderId = intent.getStringExtra("orderId");
        String slug = intent.getStringExtra("slug");
        if (orderId == null || slug == null) return null;
        if (!SAFE_SEGMENT.matcher(orderId).matches() || !SAFE_SEGMENT.matcher(slug).matches()) return null;
        // Tracker route on the live origin the shell loads (capacitor.config server.url).
        return "https://ghdidi.com/" + slug + "/order/" + orderId;
    }
}
