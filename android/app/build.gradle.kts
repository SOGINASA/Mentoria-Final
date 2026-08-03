plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val webSourceDir = rootProject.file("../front")
val webAssetsDir = layout.projectDirectory.dir("src/main/assets/www")
val defaultApiUrl = "https://foodtrack.beast-inside.kz/bahandi"

val syncWebAssets by tasks.registering(Exec::class) {
    group = "build"
    description = "Builds the React app with Android-safe relative URLs and copies it to assets."

    workingDir(rootProject.projectDir)
    commandLine("bash", "./build-web.sh")

    inputs.dir(webSourceDir.resolve("src"))
    inputs.dir(webSourceDir.resolve("public"))
    inputs.files(
        webSourceDir.resolve("package.json"),
        webSourceDir.resolve("package-lock.json")
    )
    inputs.property(
        "reactAppApiUrl",
        providers.environmentVariable("REACT_APP_API_URL").orElse(defaultApiUrl)
    )
    outputs.dir(webAssetsDir)
}

tasks.named("preBuild") {
    dependsOn(syncWebAssets)
}

android {
    namespace = "kz.itshechka.bahandi"
    compileSdk = 36

    defaultConfig {
        applicationId = "kz.itshechka.bahandi"
        minSdk = 24
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    // FileProvider для съёмки фото камерой. Остальное — платформенные API WebView.
    implementation("androidx.core:core-ktx:1.13.1")
}
