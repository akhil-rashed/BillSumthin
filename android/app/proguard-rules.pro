-keep class com.akhil.billsumthin.** { *; }
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod <methods>;
}
-dontwarn com.google.mlkit.**
-dontwarn com.google.android.gms.**
-dontwarn org.slf4j.**
-dontwarn javax.annotation.**
-dontwarn kotlin.**
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod
-dontwarn com.getcapacitor.**
-dontwarn org.apache.cordova.**
-dontwarn com.google.firebase.**
