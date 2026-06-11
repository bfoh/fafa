package com.ghdidi.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import com.google.firebase.messaging.RemoteMessage;
import io.capawesome.capacitorjs.plugins.firebase.messaging.MessagingService;
import java.util.Map;

/**
 * Renders live order-tracking updates (type=live_activity data messages) as a
 * silent ongoing notification with a progress bar — Android's equivalent of an
 * iOS Live Activity. Everything else falls through to the Capacitor Firebase
 * messaging plugin's service.
 */
public class DidiMessagingService extends MessagingService {

    private static final String CHANNEL_ID = "order_tracking";
    private static final int NOTIFICATION_ID = 0x0D1D1;

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        Map<String, String> data = remoteMessage.getData();
        if ("live_activity".equals(data.get("type"))) {
            showOrderProgress(data);
            return; // handled natively; don't surface to the JS layer
        }
        super.onMessageReceived(remoteMessage);
    }

    private void showOrderProgress(Map<String, String> data) {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "Order tracking", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Live progress of your active order");
            manager.createNotificationChannel(channel);
        }

        String phase = data.get("phase");
        boolean terminal = "delivered".equals(phase) || "cancelled".equals(phase);

        if (terminal) {
            manager.cancel(NOTIFICATION_ID);
            // Final, non-ongoing notice that clears itself.
            Notification done = baseBuilder(data)
                .setOngoing(false)
                .setAutoCancel(true)
                .setTimeoutAfter(30 * 60 * 1000L)
                .build();
            manager.notify(NOTIFICATION_ID + 1, done);
            return;
        }

        int progress = 0;
        try {
            progress = (int) Math.round(Double.parseDouble(data.get("progress")) * 100);
        } catch (Exception ignored) {}

        Notification n = baseBuilder(data)
            .setOngoing(true)
            .setProgress(100, progress, false)
            .build();
        manager.notify(NOTIFICATION_ID, n);
    }

    private NotificationCompat.Builder baseBuilder(Map<String, String> data) {
        String eta = data.get("etaMinutes");
        String text = data.get("statusText");
        if (eta != null && !eta.isEmpty()) text = text + " · ~" + eta + " min";

        Intent tap = new Intent(this, MainActivity.class);
        tap.putExtra("orderId", data.get("orderId"));
        tap.putExtra("slug", data.get("slug"));
        tap.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(
            this, 0, tap, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(getApplicationInfo().icon)
            .setContentTitle(data.get("tenantName"))
            .setContentText(text)
            .setOnlyAlertOnce(true)
            .setContentIntent(pi);
    }
}
