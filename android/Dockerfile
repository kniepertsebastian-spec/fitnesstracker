# Build environment for the Android app (a Trusted Web Activity around the PWA, made with Bubblewrap):
# JDK 17, the Android SDK command-line tools with the platform and build tools, Node and Bubblewrap.
# Everything is installed here so nothing has to be set up on the host and Bubblewrap never asks to
# download a JDK or SDK interactively. See README.md.
FROM eclipse-temurin:17-jdk-jammy

ENV ANDROID_HOME=/opt/android-sdk
ENV PATH="${PATH}:/opt/android-sdk/cmdline-tools/latest/bin:/opt/android-sdk/platform-tools"

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl unzip ca-certificates gnupg \
 && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && rm -rf /var/lib/apt/lists/*

ARG CMDLINE_TOOLS=11076708
RUN mkdir -p ${ANDROID_HOME}/cmdline-tools \
 && curl -fsSL -o /tmp/cmdline-tools.zip "https://dl.google.com/android/repository/commandlinetools-linux-${CMDLINE_TOOLS}_latest.zip" \
 && unzip -q /tmp/cmdline-tools.zip -d ${ANDROID_HOME}/cmdline-tools \
 && mv ${ANDROID_HOME}/cmdline-tools/cmdline-tools ${ANDROID_HOME}/cmdline-tools/latest \
 && rm /tmp/cmdline-tools.zip \
 && yes | sdkmanager --licenses > /dev/null \
 && sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.1.0" \
 # Bubblewrap expects the SDK root to hold bin/ itself (the layout of its own installer), not cmdline-tools/latest/.
 && ln -s cmdline-tools/latest/bin ${ANDROID_HOME}/bin \
 && ln -s cmdline-tools/latest/lib ${ANDROID_HOME}/lib

ARG BUBBLEWRAP=1.27.0
RUN npm install -g @bubblewrap/cli@${BUBBLEWRAP}

# Bubblewrap reads where the JDK and the SDK are from this file instead of asking.
RUN mkdir -p /root/.bubblewrap \
 && printf '{"jdkPath":"%s","androidSdkPath":"%s"}' "$JAVA_HOME" "$ANDROID_HOME" > /root/.bubblewrap/config.json

WORKDIR /work
