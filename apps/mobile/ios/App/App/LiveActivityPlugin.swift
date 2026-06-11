import Foundation
import Capacitor
#if canImport(ActivityKit)
import ActivityKit
#endif

/// Starts/ends the order-tracking Live Activity. Updates after start come
/// exclusively from backend APNs pushes (apns-push-type: liveactivity).
@objc(LiveActivityPlugin)
public class LiveActivityPlugin: CAPPlugin {

    @objc func isAvailable(_ call: CAPPluginCall) {
        if #available(iOS 16.2, *) {
            call.resolve(["available": ActivityAuthorizationInfo().areActivitiesEnabled])
        } else {
            call.resolve(["available": false])
        }
    }

    @objc func start(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve([:]) // older iOS: no activity, no token
            return
        }
        guard let orderId = call.getString("orderId"),
              let orderNumber = call.getString("orderNumber"),
              let tenantName = call.getString("tenantName"),
              let slug = call.getString("slug"),
              let deliveryType = call.getString("deliveryType") else {
            call.reject("orderId, orderNumber, tenantName, slug, deliveryType required")
            return
        }
        let statusText = call.getString("statusText") ?? "Order confirmed"

        Task {
            do {
                // Reuse an existing activity for this order (page revisits).
                let existing = Activity<OrderActivityAttributes>.activities
                    .first { $0.attributes.orderId == orderId }
                let activity: Activity<OrderActivityAttributes>
                if let existing {
                    activity = existing
                } else {
                    let attributes = OrderActivityAttributes(
                        orderId: orderId, orderNumber: orderNumber,
                        tenantName: tenantName, slug: slug, deliveryType: deliveryType
                    )
                    let state = OrderActivityAttributes.ContentState(
                        phase: "confirmed", progress: 0, etaMinutes: nil,
                        statusText: statusText, distanceMeters: nil
                    )
                    activity = try Activity.request(
                        attributes: attributes,
                        content: .init(state: state, staleDate: nil),
                        pushType: .token
                    )
                }
                // First token usually arrives within a second.
                for await tokenData in activity.pushTokenUpdates {
                    let token = tokenData.map { String(format: "%02x", $0) }.joined()
                    call.resolve(["token": token])
                    return
                }
                call.resolve([:])
            } catch {
                call.reject("Live Activity request failed: \(error.localizedDescription)")
            }
        }
    }

    @objc func end(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else { call.resolve(); return }
        let orderId = call.getString("orderId")
        Task {
            for activity in Activity<OrderActivityAttributes>.activities
            where orderId == nil || activity.attributes.orderId == orderId {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
            call.resolve()
        }
    }
}
