import Foundation
#if canImport(ActivityKit)
import ActivityKit

@available(iOS 16.2, *)
struct OrderActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var phase: String        // confirmed | preparing | ready | on_the_way | delivered | cancelled
        var progress: Double     // 0..1 within the delivery leg
        var etaMinutes: Int?
        var statusText: String
        var distanceMeters: Int?
    }

    var orderId: String
    var orderNumber: String
    var tenantName: String
    var slug: String
    var deliveryType: String     // delivery | pickup
}
#endif
