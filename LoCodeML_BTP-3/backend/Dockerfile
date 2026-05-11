# Base image with Python and dependencies
FROM python:3.12 AS base
RUN apt-get update && apt-get install -y libsasl2-dev python3-dev libldap2-dev libssl-dev slapd

# Create a virtual environment and install dependencies
FROM base AS dependencies
ENV VIRTUAL_ENV=/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"
WORKDIR /cache/
# Copy only requirements.txt first to leverage caching
COPY requirements.txt .
RUN python -m venv /venv
RUN pip install -r requirements.txt

# Create the final image
FROM python:3.12-slim AS final
EXPOSE 5000
RUN apt-get update && apt-get install -y libldap-2.5.0

# Install system dependencies for OpenCV
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Set up Kaggle configuration
ENV VIRTUAL_ENV=/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"
ENV KAGGLE_CONFIG_DIR=/root/.kaggle

# Create .kaggle directory with proper permissions
RUN mkdir -p /root/.kaggle && chmod 700 /root/.kaggle

WORKDIR /app/
COPY --from=dependencies /venv /venv
COPY . /app/

# Ensure Kaggle package is installed
RUN pip install --no-cache-dir kaggle

# Set proper permissions for the application directory
RUN chmod -R 755 /app/
