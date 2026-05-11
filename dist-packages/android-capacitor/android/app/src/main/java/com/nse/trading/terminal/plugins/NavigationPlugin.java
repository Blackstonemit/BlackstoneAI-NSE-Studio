package com.nse.trading.terminal.plugins;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "Navigation")
public class NavigationPlugin extends Plugin {

    @PluginMethod
    public void navigate(PluginCall call) {
        String path = call.getString("path", "/");
        getBridge().getWebView().post(() -> {
            getBridge().getWebView().evaluateJavascript(
                "window.location.href = '" + path + "';",
                null
            );
        });
        call.resolve();
    }
}
