-keep public class * extends com.getcapacitor.Plugin
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.annotation.CapacitorPlugin <init>();
    @com.getcapacitor.PluginMethod public *;
}
-keep class com.nse.trading.terminal.** { *; }
