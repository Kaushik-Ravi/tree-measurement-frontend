package com.elitetree.app

import android.content.Context
import android.graphics.*
import android.util.AttributeSet
import android.view.View

class ReticleOverlayView @JvmOverloads constructor(
    context: Context, attrs: AttributeSet? = null, defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    // 0 = Scanning, 1 = TargetingBase, 2 = TargetingDBH, 3 = TargetingTop, 4 = TargetingTopFreeze, 5 = Summary
    var state: Int = 0 
    
    // Base Anchor Screen Position
    var baseScreenX: Float = -1f
    var baseScreenY: Float = -1f
    var isBaseBehindCamera: Boolean = false
    
    // Top Anchor Screen Position
    var topScreenX: Float = -1f
    var topScreenY: Float = -1f
    
    // DBH Screen Position and Radius
    var dbhScreenX: Float = -1f
    var dbhScreenY: Float = -1f
    var dbhScreenRadius: Float = 0f
    
    // Magnifier properties
    var magnifierX: Float = -1f
    var magnifierY: Float = -1f
    var frozenBitmap: Bitmap? = null
    private var bitmapShader: BitmapShader? = null
    private val matrix = Matrix()
    
    fun updateFrozenBitmap(bitmap: Bitmap?) {
        this.frozenBitmap = bitmap
        if (bitmap != null) {
            bitmapShader = BitmapShader(bitmap, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP)
        } else {
            bitmapShader = null
        }
        invalidate()
    }

    private val linePaint = Paint().apply {
        color = Color.parseColor("#D500F9")
        strokeWidth = 6f
        style = Paint.Style.STROKE
        isAntiAlias = true
        strokeCap = Paint.Cap.ROUND
    }
    
    private val dbhPaint = Paint().apply {
        color = Color.parseColor("#00E5FF") // Cyan for DBH
        strokeWidth = 8f
        style = Paint.Style.STROKE
        isAntiAlias = true
        strokeCap = Paint.Cap.ROUND
    }
    
    private val shadowPaint = Paint().apply {
        color = Color.argb(120, 0, 0, 0)
        strokeWidth = 10f
        style = Paint.Style.STROKE
        isAntiAlias = true
        strokeCap = Paint.Cap.ROUND
    }

    private val anchorPaint = Paint().apply {
        color = Color.WHITE
        style = Paint.Style.FILL
        isAntiAlias = true
    }
    
    private val safeZonePaint = Paint().apply {
        color = Color.parseColor("#8800FF00") // Semi-transparent Green
        strokeWidth = 4f
        style = Paint.Style.STROKE
        pathEffect = DashPathEffect(floatArrayOf(20f, 20f), 0f)
        isAntiAlias = true
    }
    
    private val magnifierPaint = Paint().apply {
        isAntiAlias = true
        isFilterBitmap = true
    }
    
    private val magnifierBorderPaint = Paint().apply {
        color = Color.WHITE
        strokeWidth = 8f
        style = Paint.Style.STROKE
        isAntiAlias = true
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)

        val cx = width / 2f
        val cy = height / 2f

        // Draw crosshair center point for all targeting states (except freeze)
        if (state in 1..3) {
            canvas.drawCircle(cx, cy, 5f, shadowPaint)
            canvas.drawCircle(cx, cy, 5f, anchorPaint)
            
            // Crosshair lines
            canvas.drawLine(cx - 20f, cy, cx + 20f, cy, shadowPaint)
            canvas.drawLine(cx - 20f, cy, cx + 20f, cy, linePaint)
            canvas.drawLine(cx, cy - 20f, cx, cy + 20f, shadowPaint)
            canvas.drawLine(cx, cy - 20f, cx, cy + 20f, linePaint)
        }
        
        // Target Top Freeze State (Magnifier)
        if (state == 4) {
            // Draw Safe Zone (Center 60%)
            val safeLeft = width * 0.2f
            val safeRight = width * 0.8f
            val safeTop = height * 0.2f
            val safeBottom = height * 0.8f
            canvas.drawRect(safeLeft, safeTop, safeRight, safeBottom, shadowPaint)
            canvas.drawRect(safeLeft, safeTop, safeRight, safeBottom, safeZonePaint)
            
            // Draw Magnifier
            if (magnifierX >= 0 && magnifierY >= 0 && bitmapShader != null) {
                val loupeRadius = 150f
                val zoomFactor = 2.0f
                
                // Position loupe above the finger so it doesn't block
                var loupeX = magnifierX
                var loupeY = magnifierY - 250f
                if (loupeY - loupeRadius < 0) {
                    loupeY = magnifierY + 250f // Flip below if too close to top
                }
                
                // Configure Shader Matrix
                matrix.reset()
                matrix.postTranslate(-magnifierX, -magnifierY)
                matrix.postScale(zoomFactor, zoomFactor)
                matrix.postTranslate(loupeX, loupeY)
                bitmapShader!!.setLocalMatrix(matrix)
                
                magnifierPaint.shader = bitmapShader
                
                // Draw Loupe
                canvas.drawCircle(loupeX, loupeY, loupeRadius, shadowPaint) // Shadow border
                canvas.drawCircle(loupeX, loupeY, loupeRadius, magnifierPaint) // Image content
                canvas.drawCircle(loupeX, loupeY, loupeRadius, magnifierBorderPaint) // White border
                
                // Draw Loupe Crosshair
                canvas.drawLine(loupeX - 20f, loupeY, loupeX + 20f, loupeY, linePaint)
                canvas.drawLine(loupeX, loupeY - 20f, loupeX, loupeY + 20f, linePaint)
                
                // Draw finger point indicator
                canvas.drawCircle(magnifierX, magnifierY, 10f, anchorPaint)
                canvas.drawCircle(magnifierX, magnifierY, 10f, linePaint)
            }
        }
        
        // Draw DBH Caliper Ring
        if (state == 2 && dbhScreenRadius > 0) {
            // Shadow
            canvas.drawCircle(dbhScreenX, dbhScreenY, dbhScreenRadius, shadowPaint)
            canvas.drawCircle(dbhScreenX, dbhScreenY, 5f, shadowPaint)
            // Cyan Caliper
            canvas.drawCircle(dbhScreenX, dbhScreenY, dbhScreenRadius, dbhPaint)
            canvas.drawCircle(dbhScreenX, dbhScreenY, 5f, anchorPaint)
            
            // Draw horizontal width line for clarity
            canvas.drawLine(dbhScreenX - dbhScreenRadius, dbhScreenY, dbhScreenX + dbhScreenRadius, dbhScreenY, shadowPaint)
            canvas.drawLine(dbhScreenX - dbhScreenRadius, dbhScreenY, dbhScreenX + dbhScreenRadius, dbhScreenY, dbhPaint)
        }

        // Draw connecting lines if base is locked
        if (state >= 2 && state != 4) { 
            if (!isBaseBehindCamera) {
                canvas.drawCircle(baseScreenX, baseScreenY, 15f, shadowPaint)
                canvas.drawCircle(baseScreenX, baseScreenY, 15f, anchorPaint)
                
                val endX = if (state == 5) topScreenX else cx
                val endY = if (state == 5) topScreenY else cy
                
                canvas.drawLine(baseScreenX, baseScreenY, endX, endY, shadowPaint)
                canvas.drawLine(baseScreenX, baseScreenY, endX, endY, linePaint)
            } else {
                canvas.drawLine(cx, cy, cx, height.toFloat(), shadowPaint)
                canvas.drawLine(cx, cy, cx, height.toFloat(), linePaint)
            }
            
            if (state == 5) {
                canvas.drawCircle(topScreenX, topScreenY, 15f, shadowPaint)
                canvas.drawCircle(topScreenX, topScreenY, 15f, anchorPaint)
            }
        }
    }
}

