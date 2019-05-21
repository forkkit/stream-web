package main

import (
        "github.com/micro/go-log"
	"net/http"

        "github.com/micro/go-web"
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

	// register html handler
	service.Handle("/", http.FileServer(http.Dir("html")))

	// register call handler
	service.HandleFunc("/stream/call", handler.StreamCall)

	// run service
        if err := service.Run(); err != nil {
                log.Fatal(err)
        }
}
