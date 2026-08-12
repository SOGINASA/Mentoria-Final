// Роли пользователей. Совпадают с back/constants.py
export const ROLE_SENDER = 'sender'; // Отправитель (сотрудник торговой точки)
export const ROLE_MANAGER = 'manager';
export const ROLE_REVIEWER = 'reviewer'; // Проверяющий
export const ROLE_HR = 'hr';
export const ROLE_FINANCE = 'finance';
export const ROLE_OPERATIONS = 'operations';
export const ROLE_ADMIN = 'admin'; // Администратор

// Стартовый маршрут после входа в зависимости от роли
export const HOME_ROUTE_BY_ROLE = {
  [ROLE_SENDER]: '/',
  [ROLE_REVIEWER]: '/app/control',
  [ROLE_MANAGER]: '/app',
  [ROLE_HR]: '/app/hr',
  [ROLE_FINANCE]: '/app/finance',
  [ROLE_OPERATIONS]: '/app/operations',
  [ROLE_ADMIN]: '/admin',
};

export const LEGACY_HOME_ROUTE_BY_ROLE = {
  [ROLE_SENDER]: '/',
  [ROLE_REVIEWER]: '/review',
  [ROLE_ADMIN]: '/admin',
};
