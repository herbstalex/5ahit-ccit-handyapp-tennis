import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Dimensions, StyleSheet, TouchableOpacity } from 'react-native';
import { Gyroscope } from 'expo-sensors';

const { width, height } = Dimensions.get('window');

export default function GyroPingPong() {
  const [paddleY, setPaddleY] = useState(height / 2);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  
  const ballPosRef = useRef({ x: width / 2, y: height / 2 });
  const ballVelRef = useRef({ x: 3, y: 3 });
  const paddleYRef = useRef(height / 2);
  
  const [, forceUpdate] = useState({});

  const paddleWidth = 20;
  const paddleHeight = 100;
  const ballSize = 15;

  useEffect(() => {
    // Gyroscope Setup
    Gyroscope.setUpdateInterval(16);
    
    const subscription = Gyroscope.addListener(gyroData => {
      const { x } = gyroData;
      paddleYRef.current = Math.max(0, Math.min(height - paddleHeight, paddleYRef.current + x * 15));
      setPaddleY(paddleYRef.current);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (gameOver) return;

    let lastTime = Date.now();
    
    const gameLoop = () => {
      const now = Date.now();
      const deltaTime = (now - lastTime) / 16.67; // Normalize to 60fps
      lastTime = now;

      const ballPos = ballPosRef.current;
      const ballVel = ballVelRef.current;
      
      let newX = ballPos.x + ballVel.x * deltaTime;
      let newY = ballPos.y + ballVel.y * deltaTime;
      let newVelX = ballVel.x;
      let newVelY = ballVel.y;

      // Top/Bottom collision
      if (newY <= 0 || newY >= height - ballSize) {
        newVelY = -newVelY;
        newY = newY <= 0 ? 0 : height - ballSize;
      }

      // Right wall collision
      if (newX >= width - ballSize) {
        newVelX = -newVelX;
        newX = width - ballSize;
      }

      // Paddle collision
      if (newX <= paddleWidth && 
          newY + ballSize >= paddleYRef.current && 
          newY <= paddleYRef.current + paddleHeight) {
        newVelX = Math.abs(newVelX);
        newX = paddleWidth;
        setScore(s => s + 1);
        
        // Speed up slightly
        newVelX *= 1.03;
        newVelY *= 1.03;
      }

      // Game Over - ball passed paddle
      if (newX < 0) {
        setGameOver(true);
        return;
      }

      ballPosRef.current = { x: newX, y: newY };
      ballVelRef.current = { x: newVelX, y: newVelY };
      
      forceUpdate({});

      requestAnimationFrame(gameLoop);
    };

    const animationId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [gameOver]);

  const resetGame = () => {
    ballPosRef.current = { x: width / 2, y: height / 2 };
    ballVelRef.current = { x: 3, y: 3 };
    paddleYRef.current = height / 2;
    setScore(0);
    setGameOver(false);
    setPaddleY(height / 2);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.score}>Score: {score}</Text>
      
      {/* Paddle */}
      <View 
        style={[
          styles.paddle, 
          { top: paddleY, height: paddleHeight, width: paddleWidth }
        ]} 
      />
      
      {/* Ball */}
      <View 
        style={[
          styles.ball, 
          { 
            left: ballPosRef.current.x, 
            top: ballPosRef.current.y,
            width: ballSize,
            height: ballSize 
          }
        ]} 
      />
      
      {gameOver && (
        <View style={styles.gameOverContainer}>
          <Text style={styles.gameOverText}>Game Over!</Text>
          <Text style={styles.finalScore}>Final Score: {score}</Text>
          <TouchableOpacity 
            style={styles.restartButton}
            onPress={resetGame}
          >
            <Text style={styles.restartButtonText}>Restart</Text>
          </TouchableOpacity>
        </View>
      )}
      
      <Text style={styles.instructions}>
        Neige dein Handy um den Schläger zu bewegen
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  score: {
    position: 'absolute',
    top: 50,
    left: width / 2 - 50,
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    zIndex: 10,
  },
  paddle: {
    position: 'absolute',
    left: 0,
    backgroundColor: '#00ff00',
    borderRadius: 5,
  },
  ball: {
    position: 'absolute',
    backgroundColor: '#fff',
    borderRadius: 50,
  },
  gameOverContainer: {
    position: 'absolute',
    top: height / 2 - 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 30,
    margin: 20,
    borderRadius: 10,
  },
  gameOverText: {
    color: '#ff0000',
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  finalScore: {
    color: '#fff',
    fontSize: 24,
    marginBottom: 20,
  },
  restartButton: {
    backgroundColor: '#00ff00',
    padding: 15,
    borderRadius: 5,
  },
  restartButtonText: {
    color: '#000',
    fontSize: 20,
    fontWeight: 'bold',
  },
  instructions: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
  },
});