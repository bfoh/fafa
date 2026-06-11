import WidgetKit
import SwiftUI

@main
struct DidiWidgetsBundle: WidgetBundle {
    var body: some Widget {
        if #available(iOS 16.2, *) {
            OrderLiveActivity()
        }
    }
}
