import Foundation
import Capacitor

@objc(ARMeasurementPlugin)
public class ARMeasurementPlugin: CAPPlugin {
    
    @objc func measureDistance(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let rootViewController = self.bridge?.viewController else {
                call.reject("Could not find root view controller")
                return
            }
            
            let arVC = ARMeasurementViewController()
            arVC.modalPresentationStyle = .fullScreen
            
            arVC.onResult = { distance in
                if let distance = distance {
                    call.resolve([
                        "distance": distance
                    ])
                } else {
                    call.reject("AR Measurement cancelled")
                }
            }
            
            rootViewController.present(arVC, animated: true, completion: nil)
        }
    }
}
