import UIKit
import ARKit
import SceneKit

class ARMeasurementViewController: UIViewController, ARSCNViewDelegate {
    
    var sceneView: ARSCNView!
    var instructionLabel: UILabel!
    var onResult: ((Double?) -> Void)?
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        // Setup AR View
        sceneView = ARSCNView(frame: self.view.bounds)
        sceneView.delegate = self
        sceneView.showsStatistics = false
        sceneView.autoenablesDefaultLighting = true
        self.view.addSubview(sceneView)
        
        // Setup Instruction Label
        instructionLabel = UILabel()
        instructionLabel.text = "Point camera at the ground. Tap the base of the tree."
        instructionLabel.textColor = .white
        instructionLabel.backgroundColor = UIColor.black.withAlphaComponent(0.5)
        instructionLabel.textAlignment = .center
        instructionLabel.numberOfLines = 0
        instructionLabel.translatesAutoresizingMaskIntoConstraints = false
        self.view.addSubview(instructionLabel)
        
        // Setup Cancel Button
        let cancelButton = UIButton(type: .system)
        cancelButton.setTitle("Cancel", for: .normal)
        cancelButton.backgroundColor = UIColor.white.withAlphaComponent(0.8)
        cancelButton.layer.cornerRadius = 8
        cancelButton.translatesAutoresizingMaskIntoConstraints = false
        cancelButton.addTarget(self, action: #selector(cancelTapped), for: .touchUpInside)
        self.view.addSubview(cancelButton)
        
        // Layout
        NSLayoutConstraint.activate([
            instructionLabel.topAnchor.constraint(equalTo: self.view.safeAreaLayoutGuide.topAnchor, constant: 20),
            instructionLabel.leadingAnchor.constraint(equalTo: self.view.leadingAnchor, constant: 20),
            instructionLabel.trailingAnchor.constraint(equalTo: self.view.trailingAnchor, constant: -20),
            
            cancelButton.bottomAnchor.constraint(equalTo: self.view.safeAreaLayoutGuide.bottomAnchor, constant: -30),
            cancelButton.centerXAnchor.constraint(equalTo: self.view.centerXAnchor),
            cancelButton.widthAnchor.constraint(equalToConstant: 120),
            cancelButton.heightAnchor.constraint(equalToConstant: 44)
        ])
        
        // Tap Gesture
        let tapGesture = UITapGestureRecognizer(target: self, action: #selector(handleTap(_:)))
        sceneView.addGestureRecognizer(tapGesture)
    }
    
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        let configuration = ARWorldTrackingConfiguration()
        configuration.planeDetection = [.horizontal]
        sceneView.session.run(configuration)
    }
    
    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        sceneView.session.pause()
    }
    
    @objc func cancelTapped() {
        onResult?(nil)
        self.dismiss(animated: true, completion: nil)
    }
    
    @objc func handleTap(_ gestureRecognize: UIGestureRecognizer) {
        let location = gestureRecognize.location(in: sceneView)
        
        // Top 1% Tier Native Math: Raycasting against estimated horizontal planes
        guard let query = sceneView.raycastQuery(from: location, allowing: .estimatedPlane, alignment: .horizontal) else { return }
        
        let results = sceneView.session.raycast(query)
        if let firstResult = results.first {
            // Calculate distance from camera to hit point
            guard let currentFrame = sceneView.session.currentFrame else { return }
            let cameraTransform = currentFrame.camera.transform
            let hitTransform = firstResult.worldTransform
            
            let dx = hitTransform.columns.3.x - cameraTransform.columns.3.x
            let dy = hitTransform.columns.3.y - cameraTransform.columns.3.y
            let dz = hitTransform.columns.3.z - cameraTransform.columns.3.z
            
            let distance = sqrt(dx*dx + dy*dy + dz*dz)
            
            onResult?(Double(distance))
            self.dismiss(animated: true, completion: nil)
        }
    }
}
