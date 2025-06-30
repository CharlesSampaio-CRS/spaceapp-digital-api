// Funções utilitárias de validação

// Validação de email básica
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validação de senha básica
export const isValidPassword = (password) => {
  return password && password.length >= 6;
};

// Validação de nome básica
export const isValidName = (name) => {
  return name && name.trim().length >= 2;
}; 