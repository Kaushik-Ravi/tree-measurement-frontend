package com.elitetree.app;

import android.content.Intent;
import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ARMeasurement")
public class ARMeasurementPlugin extends Plugin {

    @PluginMethod
    public void measureDistance(PluginCall call) {
        Intent intent = new Intent(getContext(), ARMeasurementActivity.class);
        startActivityForResult(call, intent, "arMeasurementResult");
    }

    @ActivityCallback
    private void arMeasurementResult(PluginCall call, ActivityResult result) {
        if (call == null) return;

        if (result.getResultCode() == android.app.Activity.RESULT_OK) {
            Intent data = result.getData();
            if (data != null) {
                double distance = data.getDoubleExtra("distance", 0.0);
                double height = data.getDoubleExtra("height", 0.0);
                double dbh = data.getDoubleExtra("dbh", 0.0);
                JSObject ret = new JSObject();
                ret.put("distance", distance);
                ret.put("height", height);
                ret.put("dbh", dbh);
                call.resolve(ret);
            } else {
                call.reject("No data returned from AR Measurement");
            }
        } else {
            call.reject("AR Measurement cancelled");
        }
    }
}
