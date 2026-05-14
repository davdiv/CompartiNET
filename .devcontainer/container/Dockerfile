FROM archlinux:latest

RUN pacman -Syu --noconfirm nodejs npm git docker docker-buildx which sudo less bash-completion nano
RUN useradd -m node

USER node
RUN curl -fsSL https://claude.ai/install.sh | bash

USER root
COPY sudo-docker /etc/sudoers.d/sudo-docker
COPY docker dfdocker /usr/local/bin/

RUN SNIPPET="export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history" \
  && mkdir /commandhistory \
  && touch /commandhistory/.bash_history \
  && chown -R node /commandhistory \
  && echo "$SNIPPET" >> "/home/node/.bashrc"

USER node
ENV PATH=/home/node/.local/bin:$PATH
