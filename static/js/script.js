document.addEventListener("DOMContentLoaded", () => {
    const chatForm = document.getElementById("chat-form");
    const chatMessages = document.getElementById("chat-messages");
    const userInput = document.getElementById("user-input");
    const newChatBtn = document.getElementById("new-chat-btn");
    let conversationId;

    function createNewConversation() {
        fetch("/api/new_chat", {
            method: "POST",
        })
            .then((response) => response.json())
            .then((data) => {
                conversationId = data.conversation_id;
                fetchConversations();
            })
            .catch((error) => {
                console.error("Error:", error);
            });
    }

    // Add this function to fetch conversations and populate the list
    function fetchConversations() {
        fetch("/api/get_conversations")
            .then((response) => response.json())
            .then((data) => {
                const conversationList = document.getElementById("conversation-list");
                conversationList.innerHTML = "";

                if (data.conversation_ids.length === 0) {
                    // New user session: create a new conversation
                    createNewConversation();
                } else {
                    data.conversation_ids.forEach((conversation_id) => {
                        const listItem = document.createElement("li");
                        listItem.textContent = `Conversation: ${conversation_id}`;
                        listItem.classList.add("conversation-item");
                        listItem.dataset.conversationId = conversation_id;
                        listItem.addEventListener("click", () => {
                            loadConversation(conversation_id);
                        });
                        conversationList.appendChild(listItem);
                    });
                }
            })
            .catch((error) => {
                console.error("Error:", error);
            });
    }

    // Call the function to fetch the conversations initially
    fetchConversations();

    function loadConversation(conversation_id) {
        fetch(`/api/get_conversation_history?conversation_id=${conversation_id}`)
            .then((response) => response.json())
            .then((data) => {
                if (data.success) {
                    chatMessages.innerHTML = "";
                    data.conversation_history.forEach((message) => {
                        addMessage(message.role, message.content);
                    });
                } else {
                    console.error("Error:", data.error);
                }
            })
            .catch((error) => {
                console.error("Error:", error);
            });
    }

    newChatBtn.addEventListener("click", () => {
        chatMessages.innerHTML = "";
        createNewConversation();
    });

    let source;
    let botMessageElement;

    chatForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const userMessage = userInput.value.trim();
        if (!userMessage) return;

        addMessage("user", userMessage);
        userInput.value = "";

        if (source) {
            source.close();
        }

        botMessageElement = null;

        source = new EventSource("/api/chat?message=" + encodeURIComponent(userMessage));
        source = new EventSource(`/api/chat?message=${encodeURIComponent(userMessage)}&conversation_id=${conversationId}`);
        source.onmessage = (event) => {
            // console.log("event", event)
            const word = event.data;
            if (!botMessageElement) {
                botMessageElement = addMessage("bot", "", true);
                console.log("added botMessageElemt", botMessageElement)
            }
            if (word === "\n\n") {
                botMessageElement.textContent += "\n";
            } else {
                botMessageElement.textContent += word + " ";
            }
            chatMessages.scrollTop = chatMessages.scrollHeight;
        };

        source.onerror = (error) => {
            console.error("Error:", error);
            if (!botMessageElement || !botMessageElement.textContent.trim()) {
                addMessage("bot", "An error occurred while fetching the response.");
            }
            source.close();
        };
    });

    function addMessage(sender, message, createNewElement = true) {
        const wrapperElement = document.createElement("div");
        wrapperElement.classList.add("chat-message", sender);
    
        const messageElement = document.createElement("div");
        messageElement.classList.add("message");
        messageElement.textContent = message;
    
        wrapperElement.appendChild(messageElement);
    
        if (createNewElement) {
            chatMessages.appendChild(wrapperElement);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    
        return messageElement;
    }
});
