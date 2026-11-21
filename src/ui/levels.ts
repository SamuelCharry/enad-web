import type { Subject } from '../domain/types'

// Display order and spellings from Flutter's LevelPalette.
export const levelScale: Record<Subject, readonly (readonly [string, string])[]> = {
  lectura: [
    ['principiante', 'Principiante'], ['letra', 'Letra'], ['palabra', 'Palabra'],
    ['parrafo', 'Párrafo'], ['cuento', 'Cuento'], ['comprension', 'Comprensión'],
  ],
  matematicas: [
    ['principiante', 'Principiante'], ['un_digito', '1 dígito'], ['dos_digitos', '2 dígitos'],
    ['resta', 'Resta'], ['division', 'División'], ['problema_escrito', 'Problema escrito'],
  ],
}
