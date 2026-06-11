import ActivityKit
import WidgetKit
import SwiftUI

@available(iOS 16.2, *)
struct OrderLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: OrderActivityAttributes.self) { context in
            LockScreenCard(context: context)
                .activityBackgroundTint(Color.black.opacity(0.85))
                .activitySystemActionForegroundColor(.white)
                .widgetURL(trackerURL(context.attributes))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    BrandMark()
                }
                DynamicIslandExpandedRegion(.trailing) {
                    EtaText(minutes: context.state.etaMinutes, phase: context.state.phase)
                        .font(.subheadline.weight(.semibold))
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(context.state.statusText)
                            .font(.subheadline.weight(.semibold))
                        SegmentedBar(state: context.state, deliveryType: context.attributes.deliveryType)
                    }
                }
            } compactLeading: {
                ProgressRing(state: context.state, deliveryType: context.attributes.deliveryType)
            } compactTrailing: {
                EtaText(minutes: context.state.etaMinutes, phase: context.state.phase)
                    .font(.caption2.weight(.semibold))
            } minimal: {
                ProgressRing(state: context.state, deliveryType: context.attributes.deliveryType)
            }
            .widgetURL(trackerURL(context.attributes))
        }
    }

    private func trackerURL(_ attrs: OrderActivityAttributes) -> URL? {
        URL(string: "https://ghdidi.com/\(attrs.slug)/order/\(attrs.orderId)")
    }
}

@available(iOS 16.2, *)
private struct LockScreenCard: View {
    let context: ActivityViewContext<OrderActivityAttributes>

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                BrandMark()
                Text(context.attributes.tenantName)
                    .font(.subheadline.weight(.semibold))
                Spacer()
                EtaText(minutes: context.state.etaMinutes, phase: context.state.phase)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Text(context.state.statusText)
                .font(.headline)
            SegmentedBar(state: context.state, deliveryType: context.attributes.deliveryType)
            HStack {
                Text("Confirmed").font(.caption2).foregroundStyle(.secondary)
                Spacer()
                Text(context.attributes.deliveryType == "pickup" ? "Ready" : "Delivered")
                    .font(.caption2).foregroundStyle(.secondary)
            }
            Text("Order #\(context.attributes.orderNumber)")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .padding(16)
        .foregroundStyle(.white)
    }
}

private struct BrandMark: View {
    var body: some View {
        RoundedRectangle(cornerRadius: 6)
            .fill(LinearGradient(colors: [Color(red: 0.22, green: 0.74, blue: 0.97),
                                          Color(red: 0.15, green: 0.39, blue: 0.92)],
                                 startPoint: .topLeading, endPoint: .bottomTrailing))
            .frame(width: 24, height: 24)
            .overlay(Text("D").font(.caption.weight(.bold)).foregroundStyle(.white))
    }
}

@available(iOS 16.2, *)
private struct EtaText: View {
    let minutes: Int?
    let phase: String

    var body: some View {
        if phase == "delivered" {
            Text("Done")
        } else if phase == "cancelled" {
            Text("—")
        } else if let minutes {
            Text("~\(minutes) min")
        } else {
            Text("")
        }
    }
}

@available(iOS 16.2, *)
private struct ProgressRing: View {
    let state: OrderActivityAttributes.ContentState
    let deliveryType: String

    // Overall journey fraction across all segments, for the compact ring.
    private var overall: Double {
        let phases = deliveryType == "pickup"
            ? ["confirmed", "preparing", "ready"]
            : ["confirmed", "preparing", "ready", "on_the_way"]
        if state.phase == "delivered" { return 1 }
        if state.phase == "cancelled" { return 0 }
        guard let idx = phases.firstIndex(of: state.phase) else { return 0 }
        let per = 1.0 / Double(phases.count)
        let within = state.phase == "on_the_way" ? state.progress : 0.5
        return per * Double(idx) + per * within
    }

    var body: some View {
        ZStack {
            Circle().stroke(Color.white.opacity(0.25), lineWidth: 3)
            Circle()
                .trim(from: 0, to: overall)
                .stroke(Color(red: 0.2, green: 0.83, blue: 0.6),
                        style: StrokeStyle(lineWidth: 3, lineCap: .round))
                .rotationEffect(.degrees(-90))
        }
        .frame(width: 18, height: 18)
    }
}

@available(iOS 16.2, *)
private struct SegmentedBar: View {
    let state: OrderActivityAttributes.ContentState
    let deliveryType: String

    // Segments: delivery = confirmed/preparing/ready/on_the_way; pickup drops the last.
    private var phases: [String] {
        deliveryType == "pickup"
            ? ["confirmed", "preparing", "ready"]
            : ["confirmed", "preparing", "ready", "on_the_way"]
    }

    private func fill(for index: Int) -> Double {
        if state.phase == "delivered" || state.phase == "cancelled" { return 1 }
        guard let current = phases.firstIndex(of: state.phase) else { return 0 }
        if index < current { return 1 }
        if index > current { return 0 }
        // Active segment: rider progress drives on_the_way; others show half.
        return state.phase == "on_the_way" ? max(0.05, state.progress) : 0.5
    }

    var body: some View {
        HStack(spacing: 4) {
            ForEach(phases.indices, id: \.self) { i in
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(Color.white.opacity(0.25))
                        Capsule()
                            .fill(LinearGradient(colors: [Color(red: 0.22, green: 0.74, blue: 0.97),
                                                          Color(red: 0.2, green: 0.83, blue: 0.6)],
                                                 startPoint: .leading, endPoint: .trailing))
                            .frame(width: geo.size.width * fill(for: i))
                    }
                }
                .frame(height: 6)
            }
        }
    }
}
