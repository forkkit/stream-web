package main

import (
	"github.com/micro/go-log"
	"net/http"

	"github.com/micro/go-web"
	proto "github.com/microhq/stream-srv/proto/stream"
	"github.com/microhq/stream-web/handler"
)

func main() {
	// create new web service
	service := web.NewService(
		web.Name("go.micro.web.stream"),
		web.Version("latest"),
	)

	// initialise service
	if err := service.Init(); err != nil {
		log.Fatal(err)
	}

	// setup client
	client := service.Options().Service.Client()

	handler.Client = proto.NewStreamService("go.micro.srv.stream", client)

	// register html handler
	service.Handle("/", http.FileServer(http.Dir("html")))

	// register call handler
	service.HandleFunc("/video", handler.StreamVideo)

	// run service
	if err := service.Run(); err != nil {
		log.Fatal(err)
	}
}
