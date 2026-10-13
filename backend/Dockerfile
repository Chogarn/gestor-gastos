FROM python:3.14-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Sin privilegios de root: si alguien llegara a ejecutar código en el contenedor,
# no podría modificar la aplicación ni el sistema
RUN useradd --system --no-create-home app
USER app

ENV FLASK_APP=wsgi.py
EXPOSE 5000

# Aplica migraciones y arranca el servidor
CMD ["sh", "-c", "flask db upgrade && gunicorn -b 0.0.0.0:5000 wsgi:app"]
