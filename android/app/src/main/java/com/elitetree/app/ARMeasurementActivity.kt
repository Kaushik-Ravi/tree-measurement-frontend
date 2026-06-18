package com.elitetree.app

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Bitmap
import android.opengl.Matrix
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Choreographer
import android.view.MotionEvent
import android.view.PixelCopy
import android.view.ScaleGestureDetector
import android.view.View
import android.widget.ImageView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.card.MaterialCardView
import com.google.android.material.floatingactionbutton.ExtendedFloatingActionButton
import io.github.sceneview.ar.ARSceneView
import com.google.ar.core.Anchor
import com.google.ar.core.Plane
import com.google.ar.core.Point
import kotlin.math.sqrt

enum class AppState {
    SCANNING,
    TARGETING_BASE,
    TARGETING_DBH,
    TARGETING_TOP,
    TARGETING_TOP_FREEZE,
    SUMMARY
}

class ARMeasurementActivity : AppCompatActivity() {

    private lateinit var sceneView: ARSceneView
    private lateinit var reticleOverlay: ReticleOverlayView
    private lateinit var frozenImageView: ImageView
    private lateinit var instructionText: TextView
    private lateinit var instructionCard: MaterialCardView
    private lateinit var actionButton: ExtendedFloatingActionButton
    private lateinit var cancelButton: ExtendedFloatingActionButton
    private lateinit var redoButton: ExtendedFloatingActionButton

    private lateinit var scaleGestureDetector: ScaleGestureDetector

    private var currentState = AppState.SCANNING
    
    private var baseAnchor: Anchor? = null
    private var topAnchor: Anchor? = null
    
    private var dbhRadiusPhysical = 0.15f
    private var finalDistance = 0.0
    private var finalHeight = 0.0
    
    private var lastUiInteractionTime = 0L
    
    private var frozenViewMatrix = FloatArray(16)
    private var frozenProjMatrix = FloatArray(16)
    private var frozenCameraPose: com.google.ar.core.Pose? = null

    private val frameCallback = object : Choreographer.FrameCallback {
        override fun doFrame(frameTimeNanos: Long) {
            updateAR()
            Choreographer.getInstance().postFrameCallback(this)
        }
    }

    @SuppressLint("ClickableViewAccessibility")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_ar_measurement)

        sceneView = findViewById(R.id.sceneView)
        reticleOverlay = findViewById(R.id.reticleOverlay)
        frozenImageView = findViewById(R.id.frozenImageView)
        instructionText = findViewById(R.id.instructionText)
        instructionCard = findViewById(R.id.instructionCard)
        actionButton = findViewById(R.id.actionButton)
        cancelButton = findViewById(R.id.cancelButton)
        redoButton = findViewById(R.id.redoButton)

        setupUI()
        
        scaleGestureDetector = ScaleGestureDetector(this, object : ScaleGestureDetector.SimpleOnScaleGestureListener() {
            override fun onScale(detector: ScaleGestureDetector): Boolean {
                if (currentState == AppState.TARGETING_DBH) {
                    dbhRadiusPhysical *= detector.scaleFactor
                    dbhRadiusPhysical = dbhRadiusPhysical.coerceIn(0.02f, 2.0f)
                    return true
                }
                return false
            }
        })
        
        sceneView.setOnTouchListener { _, event ->
            // UI Interference Blocker (300ms)
            if (System.currentTimeMillis() - lastUiInteractionTime < 300) {
                return@setOnTouchListener true
            }

            if (currentState == AppState.TARGETING_TOP_FREEZE) {
                if (event.action == MotionEvent.ACTION_MOVE || event.action == MotionEvent.ACTION_DOWN) {
                    reticleOverlay.magnifierX = event.x
                    reticleOverlay.magnifierY = event.y
                    
                    // Clamp to Safe Zone (Center 60%)
                    val safeLeft = sceneView.width * 0.2f
                    val safeRight = sceneView.width * 0.8f
                    val safeTop = sceneView.height * 0.2f
                    val safeBottom = sceneView.height * 0.8f
                    
                    reticleOverlay.magnifierX = reticleOverlay.magnifierX.coerceIn(safeLeft, safeRight)
                    reticleOverlay.magnifierY = reticleOverlay.magnifierY.coerceIn(safeTop, safeBottom)
                    
                    reticleOverlay.invalidate()
                }
                return@setOnTouchListener true
            }

            scaleGestureDetector.onTouchEvent(event)

            if (event.action == MotionEvent.ACTION_UP && !scaleGestureDetector.isInProgress) {
                confirmCenterTarget()
            }
            true
        }
    }

    override fun onResume() {
        super.onResume()
        Choreographer.getInstance().postFrameCallback(frameCallback)
    }

    override fun onPause() {
        super.onPause()
        Choreographer.getInstance().removeFrameCallback(frameCallback)
    }

    private fun setupUI() {
        instructionText.text = "IMPORTANT: Stand at a distance equal to the tree's height (1:1 ratio) to prevent Tangent Error. Point camera at floor."
        actionButton.visibility = View.GONE
        redoButton.visibility = View.GONE
        frozenImageView.visibility = View.GONE
        
        cancelButton.setOnClickListener {
            lastUiInteractionTime = System.currentTimeMillis()
            setResult(RESULT_CANCELED)
            finish()
        }
        
        redoButton.setOnClickListener {
            lastUiInteractionTime = System.currentTimeMillis()
            if (currentState == AppState.TARGETING_DBH) {
                baseAnchor?.detach()
                baseAnchor = null
                currentState = AppState.TARGETING_BASE
                instructionText.text = "Aim at tree base and tap screen"
                redoButton.visibility = View.GONE
                actionButton.visibility = View.GONE
            } else if (currentState == AppState.TARGETING_TOP) {
                currentState = AppState.TARGETING_DBH
                instructionText.text = "Pinch to scale DBH ring around trunk, then tap to confirm."
                redoButton.text = "Redo Base"
                actionButton.visibility = View.GONE
            } else if (currentState == AppState.TARGETING_TOP_FREEZE) {
                currentState = AppState.TARGETING_TOP
                frozenImageView.visibility = View.GONE
                reticleOverlay.updateFrozenBitmap(null)
                instructionText.text = "Aim generally at the tree top and tap screen to freeze."
                redoButton.text = "Redo DBH"
                actionButton.visibility = View.GONE
            } else if (currentState == AppState.SUMMARY) {
                topAnchor?.detach()
                topAnchor = null
                currentState = AppState.TARGETING_TOP
                frozenImageView.visibility = View.GONE
                reticleOverlay.updateFrozenBitmap(null)
                instructionText.text = "Aim generally at the tree top and tap screen to freeze."
                redoButton.text = "Redo DBH"
                actionButton.visibility = View.GONE
            }
        }
        
        actionButton.setOnClickListener {
            lastUiInteractionTime = System.currentTimeMillis()
            if (currentState == AppState.TARGETING_TOP_FREEZE) {
                val base = baseAnchor ?: return@setOnClickListener
                val camPose = frozenCameraPose ?: return@setOnClickListener
                
                val x = reticleOverlay.magnifierX
                val y = reticleOverlay.magnifierY
                
                // Screen-to-World Unprojection
                val nx = 2.0f * (x / sceneView.width) - 1.0f
                val ny = 1.0f - 2.0f * (y / sceneView.height)
                val clipPoint = floatArrayOf(nx, ny, -1.0f, 1.0f)
                
                val viewProj = FloatArray(16)
                Matrix.multiplyMM(viewProj, 0, frozenProjMatrix, 0, frozenViewMatrix, 0)
                val invViewProj = FloatArray(16)
                Matrix.invertM(invViewProj, 0, viewProj, 0)
                
                val worldPoint = FloatArray(4)
                Matrix.multiplyMV(worldPoint, 0, invViewProj, 0, clipPoint, 0)
                if (worldPoint[3] != 0f) {
                    worldPoint[0] /= worldPoint[3]
                    worldPoint[1] /= worldPoint[3]
                    worldPoint[2] /= worldPoint[3]
                }
                
                val dxRay = worldPoint[0] - camPose.tx()
                val dyRay = worldPoint[1] - camPose.ty()
                val dzRay = worldPoint[2] - camPose.tz()
                
                // True Distance Math
                val dxBase = base.pose.tx() - camPose.tx()
                val dzBase = base.pose.tz() - camPose.tz()
                val horizontalDist = sqrt((dxBase * dxBase + dzBase * dzBase).toDouble())
                val trueDist = horizontalDist + dbhRadiusPhysical.toDouble()
                
                val fHorizontal = sqrt((dxRay * dxRay + dzRay * dzRay).toDouble())
                if (fHorizontal > 0.001) {
                    val tanPitch = dyRay / fHorizontal
                    val hAboveCam = trueDist * tanPitch
                    val yTop = camPose.ty() + hAboveCam
                    
                    finalHeight = yTop - base.pose.ty()
                    finalDistance = trueDist
                    if (finalHeight < 0) finalHeight = 0.0
                    
                    val pose = com.google.ar.core.Pose.makeTranslation(base.pose.tx(), yTop.toFloat(), base.pose.tz())
                    topAnchor = sceneView.session?.createAnchor(pose)
                    
                    currentState = AppState.SUMMARY
                    frozenImageView.visibility = View.GONE
                    reticleOverlay.updateFrozenBitmap(null)
                    instructionText.text = "Height: %.1fm (True Dist: %.1fm)\nDBH: %.2fm".format(finalHeight, finalDistance, dbhRadiusPhysical * 2)
                    redoButton.text = "Redo Top"
                    actionButton.text = "Confirm"
                }
            } else if (currentState == AppState.SUMMARY) {
                val returnIntent = Intent()
                returnIntent.putExtra("distance", finalDistance)
                returnIntent.putExtra("height", finalHeight)
                returnIntent.putExtra("dbh", (dbhRadiusPhysical * 2.0).toDouble())
                setResult(RESULT_OK, returnIntent)
                finish()
            }
        }
    }

    private fun confirmCenterTarget() {
        val frame = sceneView.frame ?: return
        val cx = sceneView.width / 2f
        val cy = sceneView.height / 2f
        
        if (currentState == AppState.TARGETING_BASE) {
            val hits = frame.hitTest(cx, cy)
            val hit = hits.firstOrNull { 
                it.trackable is Plane || 
                (it.trackable is Point && (it.trackable as Point).orientationMode == Point.OrientationMode.ESTIMATED_SURFACE_NORMAL) 
            }

            if (hit != null) {
                baseAnchor = hit.createAnchor()
                
                currentState = AppState.TARGETING_DBH
                instructionText.text = "Pinch to scale DBH ring around trunk, then tap to confirm."
                redoButton.visibility = View.VISIBLE
                redoButton.text = "Redo Base"
                actionButton.visibility = View.GONE
            }
        } 
        else if (currentState == AppState.TARGETING_DBH) {
            currentState = AppState.TARGETING_TOP
            instructionText.text = "Aim generally at the tree top and tap screen to freeze."
            redoButton.text = "Redo DBH"
        }
        else if (currentState == AppState.TARGETING_TOP) {
            // Initiate Freeze
            val camera = frame.camera
            
            frozenCameraPose = camera.pose
            camera.getViewMatrix(frozenViewMatrix, 0)
            camera.getProjectionMatrix(frozenProjMatrix, 0, 0.1f, 100.0f)
            
            val bitmap = Bitmap.createBitmap(sceneView.width, sceneView.height, Bitmap.Config.ARGB_8888)
            PixelCopy.request(sceneView, bitmap, { copyResult ->
                if (copyResult == PixelCopy.SUCCESS) {
                    runOnUiThread {
                        frozenImageView.setImageBitmap(bitmap)
                        frozenImageView.visibility = View.VISIBLE
                        reticleOverlay.updateFrozenBitmap(bitmap)
                        
                        // Initialize magnifier position
                        reticleOverlay.magnifierX = sceneView.width / 2f
                        reticleOverlay.magnifierY = sceneView.height / 2f
                        
                        currentState = AppState.TARGETING_TOP_FREEZE
                        instructionText.text = "Drag the magnifier to the exact highest leaf, then tap Confirm Top."
                        redoButton.text = "Unfreeze"
                        actionButton.visibility = View.VISIBLE
                        actionButton.text = "Confirm Top"
                    }
                }
            }, Handler(Looper.getMainLooper()))
        }
    }

    private fun updateAR() {
        val frame = sceneView.frame ?: return
        val cameraPose = frame.camera.pose

        val cx = sceneView.width / 2f
        val cy = sceneView.height / 2f

        if (currentState == AppState.SCANNING || currentState == AppState.TARGETING_BASE) {
            val hits = frame.hitTest(cx, cy)
            val hit = hits.firstOrNull { 
                it.trackable is Plane || 
                (it.trackable is Point && (it.trackable as Point).orientationMode == Point.OrientationMode.ESTIMATED_SURFACE_NORMAL) 
            }

            if (hit != null) {
                if (currentState == AppState.SCANNING) {
                    currentState = AppState.TARGETING_BASE
                    instructionText.text = "Aim at tree base and tap screen"
                }
            } else {
                if (currentState == AppState.TARGETING_BASE) {
                    currentState = AppState.SCANNING
                    instructionText.text = "Point camera at floor and move slowly"
                }
            }
        } 
        else if (currentState == AppState.TARGETING_DBH || currentState == AppState.TARGETING_TOP || currentState == AppState.SUMMARY || currentState == AppState.TARGETING_TOP_FREEZE) {
            val base = baseAnchor ?: return
            val bPose = base.pose
            
            val dx = bPose.tx() - cameraPose.tx()
            val dy = bPose.ty() - cameraPose.ty()
            val dz = bPose.tz() - cameraPose.tz()
            
            val zAxis = cameraPose.zAxis
            val fx = -zAxis[0]
            val fy = -zAxis[1]
            val fz = -zAxis[2]
            
            val dotProduct = dx * fx + dy * fy + dz * fz
            reticleOverlay.isBaseBehindCamera = (dotProduct < 0.0f)

            if (!reticleOverlay.isBaseBehindCamera) {
                try {
                    val vec3 = io.github.sceneview.collision.Vector3(bPose.tx(), bPose.ty(), bPose.tz())
                    val screenPos = sceneView.cameraNode.worldToScreenPoint(vec3)
                    reticleOverlay.baseScreenX = screenPos.x
                    reticleOverlay.baseScreenY = screenPos.y
                } catch (e: Exception) {
                    reticleOverlay.baseScreenX = cx
                    reticleOverlay.baseScreenY = cy + 200f
                }
            }
            
            if (currentState == AppState.TARGETING_DBH) {
                try {
                    val dbhY = bPose.ty() + 1.37f
                    val vec3DBH = io.github.sceneview.collision.Vector3(bPose.tx(), dbhY, bPose.tz())
                    val screenPos = sceneView.cameraNode.worldToScreenPoint(vec3DBH)
                    reticleOverlay.dbhScreenX = screenPos.x
                    reticleOverlay.dbhScreenY = screenPos.y
                    
                    val vec3Edge = io.github.sceneview.collision.Vector3(bPose.tx() + dbhRadiusPhysical, dbhY, bPose.tz())
                    val edgeScreenPos = sceneView.cameraNode.worldToScreenPoint(vec3Edge)
                    
                    val sRadius = Math.abs(edgeScreenPos.x - screenPos.x)
                    reticleOverlay.dbhScreenRadius = sRadius
                } catch (e: Exception) {
                    reticleOverlay.dbhScreenRadius = 0f
                }
            } else {
                reticleOverlay.dbhScreenRadius = 0f
            }
            
            if (currentState == AppState.SUMMARY && topAnchor != null) {
                val tPose = topAnchor!!.pose
                try {
                    val vec3 = io.github.sceneview.collision.Vector3(tPose.tx(), tPose.ty(), tPose.tz())
                    val screenPos = sceneView.cameraNode.worldToScreenPoint(vec3)
                    reticleOverlay.topScreenX = screenPos.x
                    reticleOverlay.topScreenY = screenPos.y
                } catch (e: Exception) {
                    reticleOverlay.topScreenX = cx
                    reticleOverlay.topScreenY = cy - 200f
                }
            }
            
            if (currentState == AppState.TARGETING_TOP) {
                val horizontalDist = sqrt((dx * dx + dz * dz).toDouble())
                val trueDist = horizontalDist + dbhRadiusPhysical.toDouble()
                val fHorizontal = sqrt((fx * fx + fz * fz).toDouble())
                
                if (fHorizontal > 0.001) {
                    val tanPitch = fy / fHorizontal
                    val hAboveCam = trueDist * tanPitch
                    val yTop = cameraPose.ty() + hAboveCam
                    
                    var tempHeight = yTop - bPose.ty()
                    if (tempHeight < 0) tempHeight = 0.0
                    instructionText.text = "Height: %.1fm (Dist: %.1fm)".format(tempHeight, trueDist)
                }
            }
        }

        reticleOverlay.state = currentState.ordinal
        reticleOverlay.invalidate()
    }
}
