package com.example.backtotrack

import android.app.AlertDialog
import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.text.Html
import android.text.format.DateUtils
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import java.text.SimpleDateFormat
import java.util.*

class MainActivity : AppCompatActivity() {

    private lateinit var prefs: SharedPreferences
    private val TRACKED_APPS_KEY = "tracked_apps"
    private val trackedPackages = mutableSetOf<String>()
    private val tasks = mutableListOf<String>()

    private var selectedDate = Calendar.getInstance()

    // UI Variables
    private lateinit var scoreText: TextView
    private lateinit var detailsText: TextView
    private lateinit var appListText: TextView
    private lateinit var tvDate: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        prefs = getSharedPreferences("BackToTrackPrefs", Context.MODE_PRIVATE)
        loadTrackedApps()

        // Bind UI Elements
        scoreText = findViewById(R.id.tvScore)
        detailsText = findViewById(R.id.tvDetails)
        appListText = findViewById(R.id.tvAppList)
        tvDate = findViewById(R.id.tvDateDisplay)

        val btnProfile = findViewById<View>(R.id.btnProfile)
        val btnRefresh = findViewById<Button>(R.id.btnRefresh)
        val btnClear = findViewById<Button>(R.id.btnClear)
        val btnPrev = findViewById<Button>(R.id.btnPrevDate)
        val btnNext = findViewById<Button>(R.id.btnNextDate)

        // Permission Check
        if (!hasUsageStatsPermission()) {
            AlertDialog.Builder(this)
                .setTitle("Permission Required")
                .setMessage("This app needs Usage Access permission to track app usage.")
                .setPositiveButton("OK") { _, _ ->
                    startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))
                }
                .show()
        }

        // Profile Menu Click
        btnProfile.setOnClickListener { view ->
            showProfileMenu(view)
        }

        // Other Listeners
        appListText.setOnClickListener { showAppPickerDialog() }
        btnRefresh.setOnClickListener { updateScoreUI() }

        btnPrev.setOnClickListener {
            selectedDate.add(Calendar.DAY_OF_YEAR, -1)
            updateScoreUI()
        }

        btnNext.setOnClickListener {
            val today = Calendar.getInstance()
            today.set(Calendar.HOUR_OF_DAY, 0)
            today.set(Calendar.MINUTE, 0)
            today.set(Calendar.SECOND, 0)
            today.set(Calendar.MILLISECOND, 0)

            val checkDate = selectedDate.clone() as Calendar
            checkDate.add(Calendar.DAY_OF_YEAR, 1)
            checkDate.set(Calendar.HOUR_OF_DAY, 0)
            checkDate.set(Calendar.MINUTE, 0)
            checkDate.set(Calendar.SECOND, 0)
            checkDate.set(Calendar.MILLISECOND, 0)

            if (!checkDate.after(today)) {
                selectedDate.add(Calendar.DAY_OF_YEAR, 1)
                updateScoreUI()
            } else {
                Toast.makeText(this, "Cannot view future dates", Toast.LENGTH_SHORT).show()
            }
        }

        btnClear.setOnClickListener {
            AlertDialog.Builder(this)
                .setTitle("Clear Day Data")
                .setMessage("Are you sure you want to clear all data for this day?")
                .setPositiveButton("Yes") { _, _ -> clearDayData() }
                .setNegativeButton("No", null)
                .show()
        }

        updateScoreUI()
    }

    // ============== MENU LOGIC ==============

    private fun showProfileMenu(anchor: View) {
        val inflater = getSystemService(LAYOUT_INFLATER_SERVICE) as LayoutInflater
        val view = inflater.inflate(R.layout.layout_profile_menu, null)

        val popup = PopupWindow(
            view,
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT,
            true
        )

        popup.elevation = 20f
        popup.isOutsideTouchable = true
        popup.isFocusable = true

        // Handle "Tasks" Click
        val btnTasks = view.findViewById<View>(R.id.menuBtnTasks)
        btnTasks.setOnClickListener {
            popup.dismiss()
            showTaskDialog()
        }

        // Show popup below profile button
        popup.showAsDropDown(anchor, -150, 20)
    }

    // ============== TASK DIALOG LOGIC ==============

    private fun showTaskDialog() {
        val dialogView = LayoutInflater.from(this).inflate(R.layout.dialog_tasks, null)

        val dialog = AlertDialog.Builder(this)
            .setView(dialogView)
            .create()

        // Transparent background for rounded corners
        dialog.window?.setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))

        val etInput = dialogView.findViewById<EditText>(R.id.etTaskInput)
        val btnAdd = dialogView.findViewById<Button>(R.id.btnAddTask)
        val container = dialogView.findViewById<LinearLayout>(R.id.taskContainer)
        val btnClose = dialogView.findViewById<Button>(R.id.btnCloseTasks)

        // Function to render tasks in dialog
        fun renderTasks() {
            container.removeAllViews()
            loadTasks() // Refresh from storage

            if (tasks.isEmpty()) {
                val emptyText = TextView(this).apply {
                    text = "No tasks yet. Add one above! 👆"
                    textSize = 16f
                    setTextColor(Color.parseColor("#888888"))
                    gravity = Gravity.CENTER
                    setPadding(20, 40, 20, 40)
                }
                container.addView(emptyText)
                return
            }

            for (task in tasks) {
                // Create task card
                val cardView = androidx.cardview.widget.CardView(this).apply {
                    layoutParams = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                    ).apply {
                        setMargins(0, 0, 0, 12)
                    }
                    radius = 12f
                    cardElevation = 4f
                    setCardBackgroundColor(Color.parseColor("#25FFFFFF"))
                }

                val row = LinearLayout(this).apply {
                    orientation = LinearLayout.HORIZONTAL
                    setPadding(16, 16, 16, 16)
                    gravity = Gravity.CENTER_VERTICAL
                }

                val icon = TextView(this).apply {
                    text = "⭐"
                    textSize = 20f
                    layoutParams = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                    ).apply {
                        setMargins(0, 0, 12, 0)
                    }
                }

                val tv = TextView(this).apply {
                    text = task
                    setTextColor(Color.WHITE)
                    textSize = 16f
                    layoutParams = LinearLayout.LayoutParams(
                        0,
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                        1f
                    )
                }

                val btnDone = Button(this).apply {
                    text = "✓ Done"
                    textSize = 12f
                    setTextColor(Color.WHITE)
                    backgroundTintList = android.content.res.ColorStateList.valueOf(Color.parseColor("#56ab2f"))
                }

                btnDone.setOnClickListener {
                    // Add points
                    val fmt = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
                    val key = "points_" + fmt.format(selectedDate.time)
                    val curr = prefs.getInt(key, 0)
                    prefs.edit().putInt(key, curr + 10).apply()

                    // Remove task
                    tasks.remove(task)
                    saveTasks()

                    // Re-render
                    renderTasks()
                    updateScoreUI()
                    Toast.makeText(this@MainActivity, "🎉 +10 Points!", Toast.LENGTH_SHORT).show()
                }

                row.addView(icon)
                row.addView(tv)
                row.addView(btnDone)
                cardView.addView(row)
                container.addView(cardView)
            }
        }

        // Add Button Handler
        btnAdd.setOnClickListener {
            val taskText = etInput.text.toString().trim()
            if (taskText.isNotEmpty()) {
                tasks.add(taskText)
                saveTasks()
                etInput.text.clear()
                renderTasks()
                Toast.makeText(this, "Task added!", Toast.LENGTH_SHORT).show()
            } else {
                Toast.makeText(this, "Please enter a task", Toast.LENGTH_SHORT).show()
            }
        }

        btnClose.setOnClickListener { dialog.dismiss() }

        renderTasks() // Initial load
        dialog.show()
    }

    // ============== SCORE LOGIC ==============

    private fun updateScoreUI() {
        val fmt = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        val dateKey = "points_" + fmt.format(selectedDate.time)

        val taskPoints = prefs.getInt(dateKey, 0)
        val usage = getAppUsageForDate(selectedDate)
        var totalPenalty = 0.0
        val distBuilder = StringBuilder()

        val isToday = DateUtils.isToday(selectedDate.timeInMillis)
        val multiplier = if (isToday) {
            when (Calendar.getInstance().get(Calendar.HOUR_OF_DAY)) {
                in 4..11 -> 2.0
                in 12..17 -> 1.5
                else -> 1.0
            }
        } else 1.0

        for (pkg in trackedPackages) {
            val mins = usage[pkg] ?: 0L
            if (mins > 0) {
                val lost = mins * multiplier
                totalPenalty += lost
                distBuilder.append("${getAppName(pkg)}: -${lost.toInt()} (${mins}m)<br>")
            }
        }

        val finalScore = taskPoints - totalPenalty.toInt()
        scoreText.text = finalScore.toString()

        // Dynamic color and message
        if (finalScore >= 100) {
            scoreText.setTextColor(Color.parseColor("#FFD700")) // Gold
            detailsText.setTextColor(Color.parseColor("#a8e063"))
            detailsText.text = "🏆 Outstanding! Tasks: +$taskPoints | Penalty: -${totalPenalty.toInt()}"
        } else if (finalScore >= 50) {
            scoreText.setTextColor(Color.parseColor("#a8e063")) // Green
            detailsText.setTextColor(Color.parseColor("#a8e063"))
            detailsText.text = "💪 Great work! Tasks: +$taskPoints | Penalty: -${totalPenalty.toInt()}"
        } else if (finalScore >= 0) {
            scoreText.setTextColor(Color.WHITE)
            detailsText.setTextColor(Color.parseColor("#a8e063"))
            detailsText.text = "Tasks: +$taskPoints | Penalty: -${totalPenalty.toInt()}"
        } else {
            scoreText.setTextColor(Color.parseColor("#ff6b6b")) // Red
            detailsText.setTextColor(Color.parseColor("#ff6b6b"))
            detailsText.text = "⚠️ Negative Score! Tasks: +$taskPoints | Penalty: -${totalPenalty.toInt()}"
        }

        // Distractions display
        if (distBuilder.isNotEmpty()) {
            @Suppress("DEPRECATION")
            appListText.text = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                Html.fromHtml("<b>📱 Distractions:</b><br>$distBuilder", Html.FROM_HTML_MODE_COMPACT)
            } else {
                Html.fromHtml("<b>📱 Distractions:</b><br>$distBuilder")
            }
        } else {
            appListText.text = "📱 Distractions: None (Tap to add)"
        }

        // Date display
        if (isToday) {
            tvDate.text = "Today"
        } else {
            tvDate.text = SimpleDateFormat("MMM dd, yyyy", Locale.getDefault()).format(selectedDate.time)
        }
    }

    // ============== HELPER FUNCTIONS ==============

    private fun saveTasks() {
        val fmt = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        val key = "tasks_" + fmt.format(selectedDate.time)
        prefs.edit().putStringSet(key, tasks.toSet()).apply()
    }

    private fun loadTasks() {
        val fmt = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        val key = "tasks_" + fmt.format(selectedDate.time)
        val savedTasks = prefs.getStringSet(key, emptySet())
        tasks.clear()
        if (savedTasks != null) tasks.addAll(savedTasks)
    }

    private fun clearDayData() {
        val fmt = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        val key = "points_" + fmt.format(selectedDate.time)
        prefs.edit().remove(key).apply()

        if (DateUtils.isToday(selectedDate.timeInMillis)) {
            tasks.clear()
            saveTasks()
            trackedPackages.clear()
            prefs.edit().putStringSet(TRACKED_APPS_KEY, trackedPackages).apply()
        }

        updateScoreUI()
        Toast.makeText(this, "Day data cleared", Toast.LENGTH_SHORT).show()
    }

    private fun showAppPickerDialog() {
        val pm = packageManager
        val apps = pm.getInstalledApplications(PackageManager.GET_META_DATA)
            .filter { pm.getLaunchIntentForPackage(it.packageName) != null }
            .sortedBy { it.loadLabel(pm).toString() }

        val names = apps.map { it.loadLabel(pm).toString() }.toTypedArray()
        val pkgs = apps.map { it.packageName }.toTypedArray()

        AlertDialog.Builder(this)
            .setTitle("Add Distraction App")
            .setItems(names) { _, i ->
                if (!trackedPackages.contains(pkgs[i])) {
                    trackedPackages.add(pkgs[i])
                    prefs.edit().putStringSet(TRACKED_APPS_KEY, trackedPackages).apply()
                    updateScoreUI()
                    Toast.makeText(this, "Added ${names[i]}", Toast.LENGTH_SHORT).show()
                } else {
                    Toast.makeText(this, "${names[i]} already tracked", Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun getAppUsageForDate(date: Calendar): Map<String, Long> {
        if (!hasUsageStatsPermission()) return emptyMap()

        val sm = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager

        val start = date.clone() as Calendar
        start.set(Calendar.HOUR_OF_DAY, 0)
        start.set(Calendar.MINUTE, 0)
        start.set(Calendar.SECOND, 0)
        start.set(Calendar.MILLISECOND, 0)

        val end = date.clone() as Calendar
        end.set(Calendar.HOUR_OF_DAY, 23)
        end.set(Calendar.MINUTE, 59)
        end.set(Calendar.SECOND, 59)
        end.set(Calendar.MILLISECOND, 999)

        val stats = sm.queryUsageStats(
            UsageStatsManager.INTERVAL_DAILY,
            start.timeInMillis,
            end.timeInMillis
        )

        val map = mutableMapOf<String, Long>()
        if (stats != null) {
            for (s in stats) {
                val mins = s.totalTimeInForeground / 1000 / 60
                if (mins > 0) map[s.packageName] = mins
            }
        }
        return map
    }

    private fun getAppName(pkg: String): String {
        return try {
            val ai = packageManager.getApplicationInfo(pkg, 0)
            packageManager.getApplicationLabel(ai).toString()
        } catch (e: Exception) {
            pkg
        }
    }

    private fun loadTrackedApps() {
        val s = prefs.getStringSet(TRACKED_APPS_KEY, emptySet())
        trackedPackages.clear()
        if (s != null) trackedPackages.addAll(s)
    }

    private fun hasUsageStatsPermission(): Boolean {
        val appOps = getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            appOps.unsafeCheckOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                android.os.Process.myUid(),
                packageName
            )
        } else {
            @Suppress("DEPRECATION")
            appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                android.os.Process.myUid(),
                packageName
            )
        }
        return mode == AppOpsManager.MODE_ALLOWED
    }
}