package app.networked.ai;

import android.content.ComponentName;
import android.content.pm.PackageManager;

import com.getcapacitor.Plugin;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "IconSwitcher")
public class IconSwitcherPlugin extends Plugin {

    private final String[] aliases = {
        "icon_1",
        "icon_2",
        "icon_3",
        "icon_4",
        "icon_5",
        "icon_6",
        "icon_7",
        "icon_8",
        "icon_9",
        "icon_10",
        "icon_11",
        "icon_12",
        "icon_13",
        "icon_14",
        "icon_15",
        "icon_16"
    };

    @PluginMethod
    public void setIcon(PluginCall call) {
        String iconName = call.getString("iconName");

        if (iconName == null || iconName.isEmpty()) {
            call.reject("iconName is required");
            return;
        }

        String pkg = getContext().getPackageName();
        PackageManager pm = getContext().getPackageManager();

        // disable all icons
        for (String alias : aliases) {
            ComponentName component = new ComponentName(pkg, pkg + "." + alias);
            pm.setComponentEnabledSetting(
                component,
                PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                PackageManager.DONT_KILL_APP
            );
        }

        // enable selected icon
        ComponentName selected = new ComponentName(pkg, pkg + "." + iconName);
        pm.setComponentEnabledSetting(
            selected,
            PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
            PackageManager.DONT_KILL_APP
        );

        call.resolve();
    }

    @PluginMethod
    public void getAvailableIcons(PluginCall call) {
        try {
            JSArray array = new JSArray();

            for (String alias : aliases) {
                array.put(alias);
            }

            JSObject result = new JSObject();
            result.put("icons", array);

            call.resolve(result);

        } catch (Exception e) {
            call.reject("Error getting icons");
        }
    }
}
