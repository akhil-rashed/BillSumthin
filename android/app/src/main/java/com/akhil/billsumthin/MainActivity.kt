package com.akhil.billsumthin

import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(NativeCameraPlugin::class.java)
        registerPlugin(NativeOcrPlugin::class.java)
        registerPlugin(NativeFileExportPlugin::class.java)
        registerPlugin(NativeFirebasePlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
