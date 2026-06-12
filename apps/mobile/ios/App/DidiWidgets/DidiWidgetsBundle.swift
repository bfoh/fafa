import WidgetKit
import SwiftUI

// The target's deployment minimum is iOS 16.2, so OrderLiveActivity needs no
// availability branch. Keeping it unconditional matters: a WidgetBundle whose
// only widget sits behind `if #available` goes through
// WidgetBundleBuilder.buildLimitedAvailability, which is known to silently
// skip registering ActivityConfigurations — the activity then runs (token and
// all) with no UI ever rendered.
@main
struct DidiWidgetsBundle: WidgetBundle {
    var body: some Widget {
        OrderLiveActivity()
    }
}
