"""
Genera los QR de los paraderos: qr/<codigo>.svg (para imprimir) y qr/<codigo>.png.

Cada QR abre la app con el paradero ya elegido en el formulario:
    https://dagui711.github.io/crispy-spoon/?paradero=<codigo>

Los códigos salen de js/catalogos.js y la dirección de la app de js/config.js,
así no hay que escribirlos dos veces. Si se agrega un paradero o cambia la
dirección, basta con volver a correr este archivo.

Uso (desde la carpeta del proyecto):
    pip install segno
    python qr/generar_qr.py
"""
import pathlib
import re

import segno

RAIZ = pathlib.Path(__file__).resolve().parent.parent
CARPETA = RAIZ / "qr"

config = (RAIZ / "js" / "config.js").read_text(encoding="utf-8")
catalogos = (RAIZ / "js" / "catalogos.js").read_text(encoding="utf-8")

url_app = re.search(r'URL_PUBLICA\s*=\s*"([^"]+)"', config).group(1)
semilla = catalogos.split("PARADEROS_SEMILLA", 1)[1].split("];", 1)[0]
codigos = re.findall(r'codigo:\s*"([^"]+)"', semilla)

for codigo in codigos:
    enlace = f"{url_app}?paradero={codigo}"
    # Corrección de errores alta (H): el QR se sigue leyendo aunque el cartel
    # se ensucie o se raye un poco (hasta ~30 % del código)
    qr = segno.make(enlace, error="h", micro=False)
    # border=4: el margen blanco que exige el estándar para que se pueda leer
    qr.save(CARPETA / f"{codigo}.svg", scale=10, border=4, dark="#000000", light="#ffffff",
            title=f"QR del paradero {codigo}", xmldecl=False)
    qr.save(CARPETA / f"{codigo}.png", scale=24, border=4, dark="#000000", light="#ffffff")
    print(f"{codigo}: {enlace}  (versión {qr.designator})")
