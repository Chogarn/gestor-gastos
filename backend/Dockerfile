FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV FLASK_APP=wsgi.py
EXPOSE 5000

# Aplica migraciones y arranca el servidor
CMD ["sh", "-c", "flask db upgrade && gunicorn -b 0.0.0.0:5000 wsgi:app"]
