package com.elitetree.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ARMeasurementPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
