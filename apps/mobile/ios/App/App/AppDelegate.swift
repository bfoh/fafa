import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Configure Firebase via ObjC runtime — avoids Swift module import issues
        // while still initialising Firebase before the push plugin needs it.
        if let cls = NSClassFromString("FIRApp") as? NSObject.Type {
            cls.perform(NSSelectorFromString("configure"))
        }
        // Cold-start notification tap: capture the order deep link now, before
        // the bridge view controller's loadView() reads it, so the web view's
        // FIRST load is the tracker page (no landing-page flash + JS redirect).
        if let payload = launchOptions?[.remoteNotification] as? [AnyHashable: Any] {
            NotificationLaunch.pendingURL = NotificationLaunch.orderTrackerURL(from: payload)
        }
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        // Forward APNs token to Firebase Messaging so it can exchange for an FCM token.
        if let cls = NSClassFromString("FIRMessaging") as? NSObject.Type,
           let messaging = cls.perform(NSSelectorFromString("messaging"))?.takeUnretainedValue() as? NSObject {
            messaging.setValue(deviceToken, forKey: "APNSToken")
        }
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}

/// Order deep link captured from a cold-start notification tap. Our order
/// pushes (apps/web/lib/notifications/push.ts) carry { orderId, slug } in the
/// FCM data payload; the tracker lives at /<slug>/order/<orderId> on the live
/// origin the shell loads (capacitor.config server.url).
enum NotificationLaunch {
    static var pendingURL: String?

    static func orderTrackerURL(from payload: [AnyHashable: Any]) -> String? {
        guard let orderId = payload["orderId"] as? String,
              let slug = payload["slug"] as? String,
              isSafeSegment(orderId), isSafeSegment(slug) else { return nil }
        return "https://ghdidi.com/\(slug)/order/\(orderId)"
    }

    // Only path-safe ids reach the URL — push data rides in OS-level payloads,
    // so never trust it to build a load target unvalidated.
    private static func isSafeSegment(_ value: String) -> Bool {
        return !value.isEmpty && value.range(of: "^[A-Za-z0-9_-]+$", options: .regularExpression) != nil
    }
}

/// Referenced from Main.storyboard in place of CAPBridgeViewController.
/// instanceDescriptor() runs in loadView(), after didFinishLaunching has
/// stashed any notification deep link — overriding serverURL here makes the
/// tracker the first page the web view ever loads on a notification launch.
@objc(NotificationLaunchViewController)
class NotificationLaunchViewController: CAPBridgeViewController {
    override func instanceDescriptor() -> InstanceDescriptor {
        let descriptor = super.instanceDescriptor()
        if let url = NotificationLaunch.pendingURL {
            NotificationLaunch.pendingURL = nil
            descriptor.serverURL = url
        }
        return descriptor
    }
}
