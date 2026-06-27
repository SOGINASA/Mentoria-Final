import Foundation

/// Единая конфигурация подключения к бэкенду.
///
/// Бэкенд и база данных — ОБЩИЕ для веб- и iOS-приложений (тот же Flask `back/`).
/// Здесь хранится только адрес API. Когда бэкенд задеплоят на хост — поменять
/// нужно ОДНО значение (см. `environment` / `productionBaseURL`), и приложение готово.
///
/// Аналог веб-версии: там адрес задаётся одной строкой в `front/.env`
/// (`REACT_APP_API_URL`). Здесь — одной строкой ниже.
enum AppConfig {

    // ─────────────────────────────────────────────────────────────────────
    // ⬇️  ЕДИНСТВЕННОЕ МЕСТО ПЕРЕКЛЮЧЕНИЯ, когда бэкенд будет готов.
    //     .localSimulator → симулятор (localhost = Mac-хост)
    //     .localLAN       → реальный iPhone в одной Wi-Fi с Mac
    //     .production     → задеплоенный общий бэкенд
    static let environment: Environment = .production
    // ─────────────────────────────────────────────────────────────────────

    /// Боевой адрес бэкенда (общий с веб-версией). Клиент обращается к `<baseURL>/api`.
    static let productionBaseURL = "https://foodtrack.beast-inside.kz/mentoria"

    /// LAN-адрес Mac с бэкендом (для запуска на реальном iPhone в той же сети).
    /// Узнать IP: в терминале `ipconfig getifaddr en0`.
    static let lanBaseURL = "http://192.168.0.100:5252"              // TODO: IP вашего Mac

    enum Environment { case localSimulator, localLAN, production }

    /// Итоговый базовый URL. Приоритет — переопределение из Info.plist
    /// (ключ `API_BASE_URL`), что удобно для разных схем/CI без правок кода.
    static var baseURL: URL {
        if let override = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String,
           !override.isEmpty, !override.hasPrefix("$("), let url = URL(string: override) {
            return url
        }
        switch environment {
        case .localSimulator: return URL(string: "http://localhost:5252")!
        case .localLAN:       return URL(string: lanBaseURL)!
        case .production:     return URL(string: productionBaseURL)!
        }
    }
}
