plugins {
    id("com.android.application") version "9.2.1" apply false
    // Google services Gradle plugin (Firebase Android setup)
    id("com.google.gms.google-services") version "4.4.4" apply false
    id("com.google.firebase.crashlytics") version "3.0.2" apply false
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
