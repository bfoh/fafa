#import <Capacitor/Capacitor.h>

CAP_PLUGIN(LiveActivityPlugin, "LiveActivity",
  CAP_PLUGIN_METHOD(isAvailable, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(start, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(end, CAPPluginReturnPromise);
)
