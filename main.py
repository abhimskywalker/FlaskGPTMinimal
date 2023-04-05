import os
import time
from uuid import uuid4
from flask import Flask, render_template, request, jsonify, Response
import openai
from replit import db

app = Flask(__name__)

openai.api_key = os.environ['OPENAI_API_KEY']


@app.route("/")
def index():
  return render_template("index.html")


def store_chat_history(conversation_id, message, sender):
  history_key = f"conversation-{conversation_id}-history"

  if history_key not in db:
    db[history_key] = []

  db[history_key].append({"sender": sender, "message": message})
  db[history_key] = db[history_key]  # Force update the value in the database


def get_chat_history(conversation_id):
  history_key = f"conversation-{conversation_id}-history"
  history = db.get(history_key, [])
  print("history", history)
  return [dict(i) for i in history]


@app.route("/api/get_conversations", methods=["GET"])
def get_conversations():
  conversation_keys = [
    key for key in db.keys()
    if key.startswith("conversation-") and key.endswith("-history")
  ]
  conversation_ids = [
    key.replace("conversation-", "").replace("-history", "")
    for key in conversation_keys
  ]
  return jsonify({"conversation_ids": conversation_ids})


@app.route("/api/get_conversation_history", methods=["GET"])
def get_conversation_history():
  conversation_id = request.args.get("conversation_id")
  if not conversation_id:
    return jsonify({"success": False, "error": "Missing conversation_id"})

  conversation_key = f"conversation-{conversation_id}-history"
  print("conversation_key", conversation_key)

  if conversation_key not in db:
    return jsonify({"success": False, "error": "Conversation not found"})

  # conversation_history = db[conversation_key]
  conversation_history = get_chat_history(conversation_id)
  return jsonify({
    "success": True,
    "conversation_history": conversation_history
  })


@app.route("/api/new_chat", methods=["POST"])
def new_chat():
  conversation_id = str(uuid4())
  store_chat_history(conversation_id, "You are a helpful assistant.", "system")
  return jsonify({"conversation_id": conversation_id})


@app.route("/api/chat", methods=["GET"])
def chat():
  user_message = request.args.get("message")
  conversation_id = request.args.get("conversation_id")
  print("conversation_id", conversation_id)
  print("user_message", user_message)

  store_chat_history(conversation_id, user_message, "user")

  chat_history = dict(get_chat_history(conversation_id))

  def generate():
    try:
      response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=chat_history,
        stream=True,
      )
      content = ""
      for chunk in response:
        if "choices" in chunk:
          delta = chunk["choices"][0]["delta"]
          if "content" in delta:
            content += delta["content"]
            print(delta["content"])
            yield f"data: {delta['content']}\n\n"

          finish_reason = chunk["choices"][0]["finish_reason"]
          if finish_reason == "stop":
            # Send the remaining content
            if content:
              yield f"data: {content}\n\n"
            # Add assistant message to chat history
            store_chat_history(conversation_id, content, "assistant")
    except Exception as e:
      print(e)
      bot_message = "An error occurred while fetching the response."
      yield f"data: {bot_message}\n\n"

  return Response(generate(), content_type="text/event-stream")


if __name__ == "__main__":
  app.run(debug=True, host="0.0.0.0", port="5000")
