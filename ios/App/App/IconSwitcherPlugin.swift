//  Created by Ravi Gaud on 25/02/26.

import UIKit
import Capacitor

@objc(IconSwitcherPlugin)
public class IconSwitcherPlugin: CAPPlugin, CAPBridgedPlugin {

    public let identifier = "IconSwitcherPlugin"
    public let jsName = "IconSwitcher"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setIcon", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getAvailableIcons", returnType: CAPPluginReturnPromise)
    ]

    private let aliases: [String] = [
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
    ]

    @objc func setIcon(_ call: CAPPluginCall) {
        guard let iconName = call.getString("iconName") else {
            call.reject("iconName is required")
            return
        }

        DispatchQueue.main.async {

            guard UIApplication.shared.supportsAlternateIcons else {
                call.reject("Alternate icons not supported on this device")
                return
            }

            // Allow reset to primary icon if empty string passed
            let targetIcon = iconName.isEmpty ? nil : iconName

            // Optional: Validate icon exists (if not resetting)
            if let name = targetIcon, !self.aliases.contains(name) {
                call.reject("Invalid icon name")
                return
            }

            UIApplication.shared.setAlternateIconName(targetIcon) { error in
                if let error = error {
                    call.reject("Failed to change icon: \(error.localizedDescription)")
                } else {
                    call.resolve()
                }
            }
        }
    }

    @objc func getAvailableIcons(_ call: CAPPluginCall) {
        call.resolve([ "icons": aliases ])
    }
}
