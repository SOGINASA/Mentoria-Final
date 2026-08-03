import Foundation
import Speech
import AVFoundation

/// Голосовой ввод «сразу в поле» через Speech framework (SFSpeechRecognizer + AVAudioEngine).
/// Распознавание идёт на устройстве и мгновенно (частичные результаты по мере речи),
/// без отправки аудио на бэкенд.
///
/// Один активный микрофон на всю форму: в каждый момент диктуется ровно одно поле.
@MainActor
final class SpeechDictation: ObservableObject {
    enum Field: String { case name, comment }

    @Published var activeField: Field?
    @Published var listening = false
    @Published var errorKind: String?   // "denied" | "unsupported" | nil

    private let audioEngine = AVAudioEngine()
    private var recognizer: SFSpeechRecognizer?
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?

    private var base = ""                       // текст, который был в поле до диктовки
    private var apply: ((String) -> Void)?      // куда писать распознанное

    /// Есть ли на устройстве распознавание речи (для показа кнопки микрофона)
    var supported: Bool {
        SFSpeechRecognizer(locale: Locale(identifier: "ru-RU")) != nil
    }

    func toggle(_ field: Field, lang: String, current: String, apply: @escaping (String) -> Void) {
        if activeField == field, listening {
            stop()
        } else {
            begin(field, lang: lang, current: current, apply: apply)
        }
    }

    private func begin(_ field: Field, lang: String, current: String, apply: @escaping (String) -> Void) {
        errorKind = nil
        if listening { teardown() }            // переключение между полями на лету

        base = current.trimmingCharacters(in: .whitespacesAndNewlines)
        self.apply = apply

        let localeId = (lang == "kz") ? "kk-KZ" : "ru-RU"
        let rec = SFSpeechRecognizer(locale: Locale(identifier: localeId))
            ?? SFSpeechRecognizer(locale: Locale(identifier: "ru-RU"))
        guard let rec else { errorKind = "unsupported"; return }
        recognizer = rec
        activeField = field

        requestPermissions { [weak self] granted in
            guard let self else { return }
            if granted { self.run() }
            else { self.errorKind = "denied"; self.activeField = nil }
        }
    }

    private func requestPermissions(_ done: @escaping (Bool) -> Void) {
        SFSpeechRecognizer.requestAuthorization { status in
            guard status == .authorized else {
                Task { @MainActor in done(false) }
                return
            }
            AVAudioApplication.requestRecordPermission { granted in
                Task { @MainActor in done(granted) }
            }
        }
    }

    private func run() {
        guard let recognizer, recognizer.isAvailable else {
            errorKind = "unsupported"
            activeField = nil
            return
        }
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.record, mode: .measurement, options: .duckOthers)
            try session.setActive(true, options: .notifyOthersOnDeactivation)

            let req = SFSpeechAudioBufferRecognitionRequest()
            req.shouldReportPartialResults = true      // текст сразу по мере речи
            request = req

            let input = audioEngine.inputNode
            let format = input.outputFormat(forBus: 0)
            input.removeTap(onBus: 0)
            input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak req] buffer, _ in
                req?.append(buffer)
            }
            audioEngine.prepare()
            try audioEngine.start()
            listening = true

            task = recognizer.recognitionTask(with: req) { [weak self] result, error in
                guard let self else { return }
                if let result {
                    let text = result.bestTranscription.formattedString
                    let final = result.isFinal
                    Task { @MainActor in
                        self.emit(text)
                        if final { self.stop() }
                    }
                }
                if error != nil {
                    Task { @MainActor in self.stop() }
                }
            }
        } catch {
            errorKind = "unsupported"
            teardown()
            activeField = nil
        }
    }

    private func emit(_ text: String) {
        guard !text.isEmpty else { return }
        apply?(base.isEmpty ? text : base + " " + text)
    }

    func stop() {
        teardown()
        activeField = nil
        listening = false
    }

    private func teardown() {
        task?.cancel(); task = nil
        request?.endAudio(); request = nil
        if audioEngine.isRunning { audioEngine.stop() }
        audioEngine.inputNode.removeTap(onBus: 0)
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}
