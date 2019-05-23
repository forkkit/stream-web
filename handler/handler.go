package handler

import (
	"context"
	"fmt"
	"io"
	"net/http"

	"github.com/gorilla/websocket"
	proto "github.com/microhq/stream-srv/proto/stream"
)

var (
	upgrader = websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin:     func(r *http.Request) bool { return true },
	}

	Client proto.StreamService
)

func clientStream(w http.ResponseWriter, r *http.Request, id string) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}

	// subscribe to the stream
	stream, err := Client.Subscribe(context.TODO(), &proto.SubscribeRequest{
		Id: id,
	})

	if err != nil {
		fmt.Println("Subscribe error for", id, err.Error())
		return
	}
	defer stream.Close()

	for {
		msg, err := stream.Recv()
		// stream ended
		if err == io.EOF {
			return
		}
		// some other error
		if err != nil {
			fmt.Println("Stream receive error for", id, err.Error())
			return
		}
		// write the data to the websocket
		if err := conn.WriteMessage(websocket.BinaryMessage, msg.Data); err != nil {
			fmt.Println("Write message error for", id, err.Error())
			return
		}
	}
}

func serverStream(w http.ResponseWriter, r *http.Request, prefix string) {
	r.ParseForm()

	id := r.Form.Get("id")
	typ := r.Form.Get("type")

	// no id return error
	if len(id) == 0 {
		http.Error(w, "id not set", 500)
		return
	}

	// create unique id for stream
	id = fmt.Sprintf("%s-%s", prefix, id)

	// client
	if typ == "client" {
		fmt.Println("Subscribing to stream", id)
		clientStream(w, r, id)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}

	fmt.Println("Publishing stream", id)

	// create a stream
	_, err = Client.Create(context.TODO(), &proto.CreateRequest{
		Id: id,
	})
	if err != nil {
		fmt.Println("Error creating stream", id, err.Error())
		return
	}

	// send stream
	stream, err := Client.Publish(context.TODO())
	if err != nil {
		fmt.Println("Error publishing stream", id, err.Error())
		return
	}
	defer stream.Close()

	// send loop
	for {
		// read from websocket
		_, d, err := conn.ReadMessage()
		if err != nil {
			http.Error(w, err.Error(), 500)
			fmt.Println("Error reading message", id, err.Error())
			http.Error(w, err.Error(), 500)
			return
		}

		// send to server
		if err := stream.Send(&proto.Message{
			Id:   id,
			Data: d,
		}); err != nil {
			fmt.Println("Error sending message", id, err.Error())
			return
		}
	}
}

// Stream creates a server stream with the prefix provided
func Stream(prefix string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		serverStream(w, r, prefix)
	}
}
