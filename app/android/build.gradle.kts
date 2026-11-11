allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    plugins.withId("com.android.library") {
        val androidExt = extensions.getByType(com.android.build.api.dsl.LibraryExtension::class.java)
        val kotlinTargetProvider = provider {
            val target = androidExt.compileOptions.targetCompatibility
            val versionStr = if (target == JavaVersion.VERSION_1_8) "1.8" else target.majorVersion
            org.jetbrains.kotlin.gradle.dsl.JvmTarget.fromTarget(versionStr)
        }
        tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinJvmCompile::class.java).configureEach {
            compilerOptions.jvmTarget.set(kotlinTargetProvider)
        }
    }
}
subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
