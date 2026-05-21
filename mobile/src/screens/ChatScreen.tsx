import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';

export default function ChatScreen() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! I am your AI Trading Copilot.' }
  ]);

  const sendMessage = () => {
    if (!input.trim()) return;
    setMessages([...messages, { role: 'user', content: input }]);
    setInput('');
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'assistant', content: 'This is a mock AI response in the mobile app.' }]);
    }, 1000);
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AI Copilot</Text>
      </View>

      <ScrollView style={styles.chatArea} contentContainerStyle={{ padding: 16 }}>
        {messages.map((msg, i) => (
          <View key={i} style={[styles.bubble, msg.role === 'user' ? styles.userBubble : styles.aiBubble]}>
            <Text style={[styles.messageText, msg.role === 'user' ? styles.userText : styles.aiText]}>
              {msg.content}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.inputArea}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ask me anything..."
          placeholderTextColor="#71717a"
        />
        <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
          <Text style={styles.sendIcon}>^</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b' },
  header: { padding: 16, paddingTop: 40, borderBottomWidth: 1, borderBottomColor: '#27272a' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
  chatArea: { flex: 1 },
  bubble: { padding: 12, borderRadius: 16, marginBottom: 12, maxWidth: '80%' },
  userBubble: { backgroundColor: '#fff', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  aiBubble: { backgroundColor: '#18181b', alignSelf: 'flex-start', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#27272a' },
  messageText: { fontSize: 16 },
  userText: { color: '#000' },
  aiText: { color: '#e4e4e7' },
  inputArea: { flexDirection: 'row', padding: 16, backgroundColor: '#09090b', borderTopWidth: 1, borderTopColor: '#27272a', alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#18181b', color: '#fff', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 12, marginRight: 8, borderWidth: 1, borderColor: '#27272a' },
  sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  sendIcon: { fontSize: 24, fontWeight: 'bold', color: '#000', marginTop: -4 }
});
