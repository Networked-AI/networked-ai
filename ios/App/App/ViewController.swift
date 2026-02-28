//  Created by Ravi Gaud on 25/02/26.

import UIKit
import Capacitor

class ViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(IconSwitcherPlugin())
    }
}
