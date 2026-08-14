import Foundation

/// Единая конфигурация подключения к бэкенду.
///
/// Бэкенд и база данных общие для веб- и iOS-приложений.
/// Адрес можно переопределить настройкой сборки `API_BASE_URL` без правок кода.
enum AppConfig {
    static let environment: Environment = .production

    /// Клиент обращается к `<baseURL>/api`.
    static let productionBaseURL = "https://foodtrack.beast-inside.kz/bahandi"

    enum Environment { case localSimulator, production }

    /// Итоговый базовый URL. Приоритет — переопределение из Info.plist
    /// (ключ `API_BASE_URL`), что удобно для разных схем/CI без правок кода.
    static var baseURL: URL {
        if let override = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String,
           !override.isEmpty, !override.hasPrefix("$("), let url = URL(string: override) {
            return url
        }
        switch environment {
        case .localSimulator: return URL(string: "http://localhost:5252")!
        case .production:     return URL(string: productionBaseURL)!
        }
    }
}
