#!/bin/bash

SESH="campusvirtual_session"

# tmux has-session -t $SESH 2>/dev/null

# if [$? != 0]; then
  tmux new-session -d -s $SESH -n "viewer"

  tmux send-keys -t $SESH:viewer "cd Apps/campusvirtual-backend" C-m
  tmux send-keys -t $SESH:viewer "npm run start" C-m

  tmux new-window -t $SESH -n "SocketViewer"
  tmux send-keys -t $SESH:SocketViewer "cd Apps/PgSocketViewer" C-m
  tmux send-keys -t $SESH:SocketViewer "node app.js" C-m
# fi
tmux attach -t $SESH


