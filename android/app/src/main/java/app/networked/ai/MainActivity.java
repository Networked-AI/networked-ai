package app.networked.ai;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // register the icon switcher plugin
        registerPlugin(IconSwitcherPlugin.class);

        super.onCreate(savedInstanceState);

        getWindow().getDecorView().setOnApplyWindowInsetsListener((view, insets) -> {
            view.setPadding(0, insets.getSystemWindowInsetTop(), 0, insets.getSystemWindowInsetBottom());
            return insets.consumeSystemWindowInsets();
        });

        // Disable the rubber-band over-scroll effect.
        // The `WebView` stretching does not take `position: fixed` elements into account, which
        // causes the app UI to get stretched.
        // https://github.com/ionic-team/capacitor/issues/5384#issuecomment-1165811208
        bridge.getWebView().setOverScrollMode(android.view.View.OVER_SCROLL_NEVER);
    }
}
